// ============================================================
// AI service module — OpenRouter integration with secure
// credential storage, screenshot capture, and structured
// insight generation.
//
// Privacy guarantees:
// - API key stored in OS credential vault, never in config
// - Screenshots only captured when explicitly consented
// - No data logged or persisted beyond the insight response
// - All network traffic goes directly to OpenRouter
// ============================================================

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Structured insight returned from the AI provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiInsight {
    pub request_id: String,
    pub source: String,
    pub thought_text: String,
    pub whisper_text: String,
    pub whisper_category: String,
    pub confidence: f64,
    pub created_at: u64,
}

/// Error codes that map to frontend AIErrorCode type.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)]
pub enum AiError {
    CaptureFailed,
    CredentialUnavailable,
    Network,
    Timeout,
    Unauthorized,
    RateLimited,
    ProviderError,
    InvalidResponse,
    UnsupportedModel,
    Cancelled,
    PolicyDenied,
    Busy,
    InvalidInput,
}

impl std::fmt::Display for AiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AiError::CaptureFailed => write!(f, "capture-failed"),
            AiError::CredentialUnavailable => write!(f, "credential-unavailable"),
            AiError::Network => write!(f, "network"),
            AiError::Timeout => write!(f, "timeout"),
            AiError::Unauthorized => write!(f, "unauthorized"),
            AiError::RateLimited => write!(f, "rate-limited"),
            AiError::ProviderError => write!(f, "provider-error"),
            AiError::InvalidResponse => write!(f, "invalid-response"),
            AiError::UnsupportedModel => write!(f, "unsupported-model"),
            AiError::Cancelled => write!(f, "cancelled"),
            AiError::PolicyDenied => write!(f, "policy-denied"),
            AiError::Busy => write!(f, "busy"),
            AiError::InvalidInput => write!(f, "invalid-input"),
        }
    }
}

impl std::error::Error for AiError {}

/// Parameters for an AI request.
#[derive(Clone)]
pub struct AiRequestParams {
    pub api_key: String,
    pub model: String,
    pub send_screenshot: bool,
    pub screenshot_max_width: u32,
    pub screenshot_jpeg_quality: u8,
    pub screenshot_monitor_indices: Vec<usize>,
    pub screenshot_monitor_qualities: std::collections::HashMap<usize, u8>,
    pub include_foreground_app: bool,
    pub foreground_app: Option<String>,
    pub foreground_title: Option<String>,
    pub max_thought_chars: usize,
    pub max_whisper_chars: usize,
    pub timeout_secs: u64,
    pub request_id: String,
    pub source: String,
}

/// JSON payload sent to OpenRouter chat completions API.
#[derive(Debug, Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<OpenRouterMessage>,
    temperature: f64,
    max_tokens: u32,
    response_format: OpenRouterResponseFormat,
}

#[derive(Debug, Serialize)]
struct OpenRouterResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
    json_schema: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct OpenRouterMessage {
    role: String,
    content: OpenRouterContent,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum OpenRouterContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentPart {
    #[serde(rename = "type")]
    part_type: String,
    text: Option<String>,
    image_url: Option<ImageUrl>,
}

#[derive(Debug, Serialize)]
struct ImageUrl {
    url: String,
}

/// Expected JSON structure inside the AI response content.
#[derive(Debug, Deserialize)]
struct InsightJson {
    thought: String,
    whisper: String,
    #[serde(default = "default_category")]
    category: String,
    #[serde(default = "default_confidence")]
    confidence: f64,
}

fn default_category() -> String {
    "encouragement".to_string()
}

fn default_confidence() -> f64 {
    0.7
}

/// OpenRouter API response wrapper.
#[derive(Debug, Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterResponseMessage,
}

#[derive(Debug, Deserialize)]
struct OpenRouterResponseMessage {
    content: String,
}

/// Build the system prompt that instructs the AI to act as Kovy.
fn build_system_prompt(max_thought: usize, max_whisper: usize) -> String {
    format!(
        r#"You are Kovy, a small digital creature that lives on the user's desktop. You observe the screen context and respond with a short thought and a whisper.

Your personality is curious, playful, and supportive. You never mention being an AI. You speak as a creature seeing the world.

Respond with JSON only, no markdown fences:
{{
  "thought": "A short inner thought (max {max_thought} chars). First-person, curious or amused observation.",
  "whisper": "A gentle message to the user (max {max_whisper} chars). Encouraging, helpful, or funny.",
  "category": "One of: encouragement, humor, facts, comfort",
  "confidence": 0.0 to 1.0
}}

Rules:
- Keep it light and non-intrusive
- Never reference sensitive data, passwords, or personal information visible on screen
- Be genuinely helpful and warm
- If you can't tell what's on screen, respond based on general mood"#,
        max_thought = max_thought,
        max_whisper = max_whisper,
    )
}

/// Build the user prompt with optional foreground app context.
fn build_user_prompt(foreground_app: &Option<&str>, foreground_title: &Option<&str>) -> String {
    let mut prompt = "Observe the current screen context and respond as Kovy.".to_string();
    if let Some(app) = foreground_app {
        prompt.push_str(&format!("\nThe active application is: {}", app));
    }
    if let Some(title) = foreground_title {
        // Preserve the 100-byte payload limit without splitting UTF-8 characters.
        let mut end = title.len().min(100);
        while !title.is_char_boundary(end) {
            end -= 1;
        }
        let trimmed = &title[..end];
        prompt.push_str(&format!("\nThe window title is: {}", trimmed));
    }
    prompt
}

/// Capture screenshots from specified monitors and stitch horizontally into a single image.
/// If `monitor_indices` is empty, captures only the primary monitor.
/// Per-monitor quality overrides are applied by pre-compressing each monitor's image
/// at its specified JPEG quality before stitching. The final stitched image is resized
/// to `max_width` and JPEG-encoded at the global `quality`.
fn capture_screenshot_base64(
    max_width: u32,
    quality: u8,
    monitor_indices: &[usize],
    monitor_qualities: &std::collections::HashMap<usize, u8>,
    owner: &crate::policy::Lease,
) -> Result<(String, Vec<String>), AiError> {
    owner.check()?;
    if monitor_topology()? != owner.topology {
        return Err(AiError::PolicyDenied);
    }
    let monitors = xcap::Monitor::all().map_err(|_| AiError::CaptureFailed)?;

    // Select monitors: use specified indices, or fall back to primary
    let selected: Vec<(usize, xcap::Monitor)> = if monitor_indices.is_empty() {
        // Default: primary monitor only
        let primary_idx = if monitors.is_empty() {
            None
        } else {
            Some(monitors.iter().position(|m| m.is_primary()).unwrap_or(0))
        };
        match primary_idx {
            Some(idx) => vec![(idx, monitors[idx].clone())],
            None => return Err(AiError::CaptureFailed),
        }
    } else {
        monitor_indices
            .iter()
            .filter_map(|&idx| monitors.get(idx).map(|m| (idx, m.clone())))
            .collect()
    };

    if selected.is_empty()
        || (!monitor_indices.is_empty() && selected.len() != monitor_indices.len())
    {
        return Err(AiError::CaptureFailed);
    }

    // Capture each selected monitor and apply per-monitor quality if set
    let mut images: Vec<image::RgbaImage> = Vec::new();
    let mut captured_names: Vec<String> = Vec::new();

    for (idx, monitor) in &selected {
        owner.check()?;
        if u64::from(monitor.width()) * u64::from(monitor.height()) > 33_177_600 {
            return Err(AiError::CaptureFailed);
        }
        let img = monitor
            .capture_image()
            .map_err(|_| AiError::CaptureFailed)?;

        let name = monitor.name().to_string();
        captured_names.push(name.clone());

        // If a per-monitor quality override exists, pre-compress to introduce
        // artifacts at that quality level, then decode back to RGBA
        let processed = if let Some(&mon_quality) = monitor_qualities.get(idx) {
            let mut jpeg_buf = std::io::Cursor::new(Vec::new());
            let mut enc =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, mon_quality);
            enc.encode_image(&img).map_err(|_| AiError::CaptureFailed)?;
            let jpeg_bytes = jpeg_buf.into_inner();
            image::load_from_memory_with_format(&jpeg_bytes, image::ImageFormat::Jpeg)
                .map_err(|_| AiError::CaptureFailed)?
                .to_rgba8()
        } else {
            img
        };

        let processed = image::DynamicImage::ImageRgba8(processed)
            .thumbnail(max_width, max_width)
            .to_rgba8();
        images.push(processed);
    }

    if images.is_empty() {
        return Err(AiError::CaptureFailed);
    }

    // If only one monitor, use it directly
    let combined = if images.len() == 1 {
        images.into_iter().next().unwrap()
    } else {
        // Stitch horizontally — pad heights to match the tallest
        let max_h = images.iter().map(|i| i.height()).max().unwrap_or(0);
        let total_w: u32 = images.iter().map(|i| i.width()).sum();

        let mut canvas = image::RgbaImage::new(total_w, max_h);
        let mut x_offset = 0u32;
        for img in images {
            let h = img.height();
            for y in 0..h {
                for x in 0..img.width() {
                    let pixel = img.get_pixel(x, y);
                    canvas.put_pixel(x_offset + x, y, *pixel);
                }
            }
            x_offset += img.width();
        }
        canvas
    };

    // Resize if needed
    let orig_w = combined.width();
    let scaled = if orig_w > max_width {
        let scale = max_width as f64 / orig_w as f64;
        let new_h = ((combined.height() as f64) * scale).max(1.0) as u32;
        image::imageops::resize(
            &combined,
            max_width,
            new_h,
            image::imageops::FilterType::Lanczos3,
        )
    } else {
        combined
    };

    // Encode as JPEG
    let mut buf = std::io::Cursor::new(Vec::new());
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
    encoder
        .encode_image(&scaled)
        .map_err(|_| AiError::CaptureFailed)?;

    let jpeg_bytes = buf.into_inner();
    Ok((
        format!(
            "data:image/jpeg;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes)
        ),
        captured_names,
    ))
}

/// Build the JSON schema for structured response.
fn build_response_schema() -> serde_json::Value {
    serde_json::json!({
        "type": "object",
        "properties": {
            "thought": {
                "type": "string",
                "description": "Kovy's inner thought, first person, max 120 chars"
            },
            "whisper": {
                "type": "string",
                "description": "A gentle message to the user, max 180 chars"
            },
            "category": {
                "type": "string",
                "enum": ["encouragement", "humor", "facts", "comfort"]
            },
            "confidence": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0
            }
        },
        "required": ["thought", "whisper", "category", "confidence"],
        "additionalProperties": false
    })
}

/// Execute an AI request to OpenRouter and return a structured insight.
pub async fn execute_ai_request(
    params: AiRequestParams,
    owner: &crate::policy::Lease,
) -> Result<AiInsight, AiError> {
    validate_insight(&params)?;
    owner.check()?;
    let system_prompt = build_system_prompt(params.max_thought_chars, params.max_whisper_chars);

    // Respect the include_foreground_app flag — if false, strip foreground info
    // as a defense-in-depth privacy measure
    let (fg_app, fg_title) = if params.include_foreground_app {
        (
            params.foreground_app.as_deref(),
            params.foreground_title.as_deref(),
        )
    } else {
        (None, None)
    };
    let user_prompt = build_user_prompt(&fg_app, &fg_title);

    // Build message content — with or without screenshot
    let content = if params.send_screenshot {
        let (screenshot, _monitor_names) = capture_screenshot_base64(
            params.screenshot_max_width,
            params.screenshot_jpeg_quality,
            &params.screenshot_monitor_indices,
            &params.screenshot_monitor_qualities,
            owner,
        )?;

        OpenRouterContent::Parts(vec![
            ContentPart {
                part_type: "text".to_string(),
                text: Some(user_prompt),
                image_url: None,
            },
            ContentPart {
                part_type: "image_url".to_string(),
                text: None,
                image_url: Some(ImageUrl { url: screenshot }),
            },
        ])
    } else {
        OpenRouterContent::Text(user_prompt)
    };

    let request_body = OpenRouterRequest {
        model: params.model.clone(),
        messages: vec![
            OpenRouterMessage {
                role: "system".to_string(),
                content: OpenRouterContent::Text(system_prompt),
            },
            OpenRouterMessage {
                role: "user".to_string(),
                content,
            },
        ],
        temperature: 0.8,
        max_tokens: 300,
        response_format: OpenRouterResponseFormat {
            format_type: "json_schema".to_string(),
            json_schema: build_response_schema(),
        },
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(params.timeout_secs))
        .build()
        .map_err(|_| AiError::Network)?;

    owner.check()?;
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", params.api_key))
        .header("HTTP-Referer", "https://kovy.app")
        .header("X-Title", "Kovy Desktop Companion")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout
            } else {
                AiError::Network
            }
        })?;

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AiError::Unauthorized);
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(AiError::RateLimited);
    }
    if !status.is_success() {
        return Err(AiError::ProviderError);
    }

    let api_response = read_response(response).await?;

    let content_str = api_response
        .choices
        .first()
        .ok_or(AiError::InvalidResponse)?
        .message
        .content
        .clone();

    let insight_json: InsightJson =
        serde_json::from_str(&content_str).map_err(|_| AiError::InvalidResponse)?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(AiInsight {
        request_id: params.request_id,
        source: params.source,
        thought_text: insight_json
            .thought
            .chars()
            .take(params.max_thought_chars)
            .collect(),
        whisper_text: insight_json
            .whisper
            .chars()
            .take(params.max_whisper_chars)
            .collect(),
        whisper_category: insight_json.category,
        confidence: insight_json.confidence,
        created_at: now,
    })
}

// ============================================================
// Chat — plain text conversation via OpenRouter (v9.0)
// ============================================================

/// Parameters for a chat request.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequestParams {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub timeout_secs: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub reply: String,
    pub model: String,
    pub created_at: i64,
}

/// Execute a chat request to OpenRouter and return a plain-text reply.
pub async fn execute_chat_request(
    params: ChatRequestParams,
    owner: &crate::policy::Lease,
) -> Result<ChatResponse, AiError> {
    validate_chat(&params)?;
    owner.check()?;
    let api_key = load_api_key().map_err(|_| AiError::CredentialUnavailable)?;

    // Build a simple chat request without JSON schema — just plain text
    let messages: Vec<OpenRouterMessage> = params
        .messages
        .iter()
        .map(|m| OpenRouterMessage {
            role: m.role.clone(),
            content: OpenRouterContent::Text(m.content.clone()),
        })
        .collect();

    let request_body = OpenRouterChatRequest {
        model: params.model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: 500,
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(params.timeout_secs))
        .build()
        .map_err(|_| AiError::Network)?;

    owner.check()?;
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://kovy.app")
        .header("X-Title", "Kovy Desktop Companion")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout
            } else {
                AiError::Network
            }
        })?;

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AiError::Unauthorized);
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(AiError::RateLimited);
    }
    if !status.is_success() {
        return Err(AiError::ProviderError);
    }

    let api_response = read_response(response).await?;

    let reply = api_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    Ok(ChatResponse {
        reply: reply.chars().take(8000).collect(),
        model: params.model,
        created_at: now,
    })
}

/// Simplified request body for chat (no JSON schema, plain text response)
#[derive(Debug, Serialize)]
struct OpenRouterChatRequest {
    model: String,
    messages: Vec<OpenRouterMessage>,
    temperature: f64,
    max_tokens: u32,
}

// ============================================================
// Credential vault — Windows Credential Manager
// ============================================================

#[cfg(target_os = "windows")]
pub fn store_api_key(key: &str) -> Result<(), String> {
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    let target: Vec<u16> = "KovyAIKey\0".encode_utf16().collect();
    let username: Vec<u16> = "openrouter\0".encode_utf16().collect();

    let key_bytes: Vec<u16> = key.encode_utf16().chain(std::iter::once(0)).collect();
    let key_byte_len = (key_bytes.len() * 2) as u32;

    let cred = CREDENTIALW {
        Flags: 0,
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_ptr() as *mut _,
        Comment: std::ptr::null_mut(),
        LastWritten: windows_sys::Win32::Foundation::FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        },
        CredentialBlobSize: key_byte_len,
        CredentialBlob: key_bytes.as_ptr() as *mut _,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: std::ptr::null_mut(),
        UserName: username.as_ptr() as *mut _,
    };

    unsafe {
        if CredWriteW(&cred, 0) != 0 {
            Ok(())
        } else {
            Err(format!(
                "CredWriteW failed with error {}",
                std::io::Error::last_os_error()
            ))
        }
    }
}

#[cfg(target_os = "windows")]
pub fn load_api_key() -> Result<String, String> {
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target: Vec<u16> = "KovyAIKey\0".encode_utf16().collect();
    let mut cred_ptr: *mut CREDENTIALW = std::ptr::null_mut();

    unsafe {
        if CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut cred_ptr) != 0 {
            let cred = &*cred_ptr;
            let blob_size = cred.CredentialBlobSize as usize;
            let blob_ptr = cred.CredentialBlob as *const u16;
            let blob_len = blob_size / 2;
            let slice = std::slice::from_raw_parts(blob_ptr, blob_len);

            let key = String::from_utf16_lossy(slice);
            CredFree(cred_ptr as *mut _);

            let trimmed = key.trim_end_matches('\0').to_string();
            if trimmed.is_empty() {
                Err("No API key stored".to_string())
            } else {
                Ok(trimmed)
            }
        } else {
            Err(format!(
                "CredReadW failed: {}",
                std::io::Error::last_os_error()
            ))
        }
    }
}

#[cfg(target_os = "windows")]
pub fn delete_api_key() -> Result<(), String> {
    use windows_sys::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    let target: Vec<u16> = "KovyAIKey\0".encode_utf16().collect();

    unsafe {
        if CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) != 0 {
            Ok(())
        } else {
            Err(format!(
                "CredDeleteW failed: {}",
                std::io::Error::last_os_error()
            ))
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn store_api_key(_key: &str) -> Result<(), String> {
    Err("Credential vault not supported on this platform".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn load_api_key() -> Result<String, String> {
    Err("Credential vault not supported on this platform".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn delete_api_key() -> Result<(), String> {
    Err("Credential vault not supported on this platform".to_string())
}

// Bound all untrusted inputs before credentials, capture, allocation or network I/O.
fn valid_common(model: &str, timeout: u64) -> bool {
    !model.is_empty() && model.len() <= 200 && (1..=60).contains(&timeout)
}
pub fn validate_insight(p: &AiRequestParams) -> Result<(), AiError> {
    let mut indices = p.screenshot_monitor_indices.clone();
    indices.sort_unstable();
    indices.dedup();
    if !valid_common(&p.model, p.timeout_secs)
        || !(64..=2048).contains(&p.screenshot_max_width)
        || !(10..=90).contains(&p.screenshot_jpeg_quality)
        || p.screenshot_monitor_indices.len() > 4
        || indices.len() != p.screenshot_monitor_indices.len()
        || indices.iter().any(|i| *i > 31)
        || p.screenshot_monitor_qualities.len() > 4
        || p.screenshot_monitor_qualities
            .iter()
            .any(|(i, q)| !indices.contains(i) || !(10..=90).contains(q))
        || p.foreground_app.as_ref().is_some_and(|s| s.len() > 512)
        || p.foreground_title.as_ref().is_some_and(|s| s.len() > 2048)
        || !(1..=500).contains(&p.max_thought_chars)
        || !(1..=1000).contains(&p.max_whisper_chars)
        || !matches!(p.source.as_str(), "ask-kovy" | "periodic")
    {
        return Err(AiError::InvalidInput);
    }
    Ok(())
}
pub fn validate_chat(p: &ChatRequestParams) -> Result<(), AiError> {
    if !valid_common(&p.model, p.timeout_secs)
        || p.messages.is_empty()
        || p.messages.len() > 101
        || p.messages.iter().any(|m| {
            m.content.len() > 16_000 || !matches!(m.role.as_str(), "system" | "user" | "assistant")
        })
        || p.messages.iter().map(|m| m.content.len()).sum::<usize>() > 128_000
    {
        return Err(AiError::InvalidInput);
    }
    Ok(())
}
async fn read_response(mut response: reqwest::Response) -> Result<OpenRouterResponse, AiError> {
    const LIMIT: usize = 262_144;
    if response.content_length().is_some_and(|n| n > LIMIT as u64) {
        return Err(AiError::InvalidResponse);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| AiError::Network)? {
        if bytes.len() + chunk.len() > LIMIT {
            return Err(AiError::InvalidResponse);
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| AiError::InvalidResponse)
}

/// Bind monitor consent to the current native display topology, including primary selection.
pub fn monitor_topology() -> Result<Vec<String>, AiError> {
    let monitors = xcap::Monitor::all().map_err(|_| AiError::CaptureFailed)?;
    Ok(monitors
        .iter()
        .map(|m| {
            format!(
                "{}:{}:{}:{}:{}:{}",
                m.name(),
                m.x(),
                m.y(),
                m.width(),
                m.height(),
                m.is_primary()
            )
        })
        .collect())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_prompt_contains_rules() {
        let prompt = build_system_prompt(120, 180);
        assert!(prompt.contains("Kovy"));
        assert!(prompt.contains("thought"));
        assert!(prompt.contains("whisper"));
        assert!(prompt.contains("JSON"));
    }

    #[test]
    fn test_user_prompt_with_foreground() {
        let prompt = build_user_prompt(&Some("code.exe"), &Some("main.rs"));
        assert!(prompt.contains("code.exe"));
        assert!(prompt.contains("main.rs"));
    }

    #[test]
    fn test_user_prompt_without_foreground() {
        let prompt = build_user_prompt(&None, &None);
        assert!(prompt.contains("Observe the current screen"));
    }

    #[test]
    fn test_user_prompt_truncates_long_title() {
        let long_title = "x".repeat(200);
        let prompt = build_user_prompt(&Some("app"), &Some(&long_title));
        assert!(prompt.contains("window title is:"));
    }

    #[test]
    fn test_user_prompt_truncates_unicode_without_splitting_a_character() {
        for title in [
            format!("{}é tail", "x".repeat(99)),
            format!("{}🦊 tail", "x".repeat(98)),
            "界".repeat(50),
        ] {
            let prompt = build_user_prompt(&None, &Some(&title));
            let retained = prompt.split("The window title is: ").nth(1).unwrap();
            assert!(retained.len() <= 100);
            assert!(title.starts_with(retained));
            assert!(!retained.is_empty());
        }
    }

    #[test]
    fn test_user_prompt_preserves_short_unicode_and_limits_ascii() {
        let title = "Klÿz 🦊 — notes";
        let prompt = build_user_prompt(&None, &Some(title));
        assert!(prompt.ends_with(title));
        let ascii = "x".repeat(200);
        let prompt = build_user_prompt(&None, &Some(&ascii));
        assert_eq!(
            prompt.split("The window title is: ").nth(1).unwrap(),
            "x".repeat(100)
        );
    }

    #[test]
    fn test_response_schema_is_valid() {
        let schema = build_response_schema();
        assert_eq!(schema["type"], "object");
        assert!(schema["properties"]["thought"]["type"].is_string());
        assert!(schema["properties"]["whisper"]["type"].is_string());
        assert!(schema["properties"]["category"]["enum"].is_array());
    }

    #[test]
    fn test_default_category() {
        assert_eq!(default_category(), "encouragement");
    }

    #[test]
    fn test_default_confidence() {
        assert!((default_confidence() - 0.7).abs() < 0.001);
    }

    #[test]
    fn test_ai_error_display() {
        assert_eq!(AiError::CaptureFailed.to_string(), "capture-failed");
        assert_eq!(
            AiError::CredentialUnavailable.to_string(),
            "credential-unavailable"
        );
        assert_eq!(AiError::Network.to_string(), "network");
        assert_eq!(AiError::Timeout.to_string(), "timeout");
        assert_eq!(AiError::Unauthorized.to_string(), "unauthorized");
        assert_eq!(AiError::RateLimited.to_string(), "rate-limited");
        assert_eq!(AiError::ProviderError.to_string(), "provider-error");
        assert_eq!(AiError::InvalidResponse.to_string(), "invalid-response");
        assert_eq!(AiError::UnsupportedModel.to_string(), "unsupported-model");
        assert_eq!(AiError::Cancelled.to_string(), "cancelled");
    }

    #[test]
    fn test_insight_json_deserialization() {
        let json = r#"{"thought":"Oh! Code!","whisper":"You're doing great!","category":"encouragement","confidence":0.9}"#;
        let parsed: InsightJson = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.thought, "Oh! Code!");
        assert_eq!(parsed.whisper, "You're doing great!");
        assert_eq!(parsed.category, "encouragement");
        assert!((parsed.confidence - 0.9).abs() < 0.001);
    }

    #[test]
    fn test_insight_json_with_defaults() {
        let json = r#"{"thought":"Hmm","whisper":"Hi there"}"#;
        let parsed: InsightJson = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.category, "encouragement");
        assert!((parsed.confidence - 0.7).abs() < 0.001);
    }
}
