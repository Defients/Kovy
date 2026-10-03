// ============================================================
// Screen capture module — captures frames, detects motion regions
// ============================================================

use parking_lot::Mutex;
use serde::Serialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct Centroid {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MotionRegion {
    pub id: u32,
    pub centroid: Centroid,
    #[serde(rename = "boundingBox")]
    pub bounding_box: BoundingBox,
    pub area: u32,
    pub energy: f64,
    pub persistence: u32,
    pub novelty: f64,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Clone, Serialize)]
struct MotionAnalysisPayload {
    regions: Vec<MotionRegion>,
    /// The width of the captured frame in pixels (before downscale).
    /// The frontend uses this with `captureHeight` to compute the DPI
    /// scale factor between physical capture resolution and logical
    /// monitor coordinates, so motion regions map correctly on
    /// high-DPI multi-monitor setups.
    #[serde(rename = "captureWidth")]
    capture_width: u32,
    /// The height of the captured frame in pixels (before downscale).
    #[serde(rename = "captureHeight")]
    capture_height: u32,
    /// The reported monitor width (logical pixels) that was captured.
    #[serde(rename = "monitorWidth")]
    monitor_width: u32,
    /// The reported monitor height (logical pixels) that was captured.
    #[serde(rename = "monitorHeight")]
    monitor_height: u32,
}

/// A rectangular region of the overlay to exclude from motion analysis.
/// Coordinates are in canvas (virtual-desktop physical) pixels, with the
/// origin at the virtual desktop's top-left. The capture loop maps these
/// into the captured frame's coordinate space each tick, so the mask stays
/// correct regardless of monitor mode (all-monitors vs single-monitor).
#[derive(Debug, Clone, Copy, serde::Deserialize, serde::Serialize)]
pub struct OverlayMaskRect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// A tracked region that persists across frames via greedy nearest-centroid matching
#[derive(Debug, Clone)]
struct TrackedRegion {
    id: u32,
    centroid: Centroid,
    bounding_box: BoundingBox,
    area: u32,
    energy: f64,
    age: u32,         // frames since first seen
    missed: u32,      // consecutive frames not matched
    persistence: u32, // total frames matched
}

pub struct CaptureManager {
    enabled: bool,
    paused: bool,
    analysis_fps: u32,
    analysis_scale: f64,
    motion_threshold: u32,
    monitor_index: usize,
    prev_frame: Option<Vec<u8>>,
    frame_width: u32,
    frame_height: u32,
    region_id_counter: u32,
    tracked_regions: Vec<TrackedRegion>,
    max_missed_frames: u32,
    /// Overlay masks in canvas (virtual-desktop physical) coordinates.
    /// When the overlay is visible to screen capture (WDA_NONE), each rendered
    /// entity (founder + siblings) would otherwise be detected as motion; these
    /// masks zero out the diff inside each entity's bounding box to prevent
    /// self-detection. Empty vec = no masking (e.g. when hidden from capture).
    overlay_masks: Vec<OverlayMaskRect>,
}

/// Sentinel value meaning "capture all monitors as a stitched virtual desktop"
pub const ALL_MONITORS: usize = usize::MAX;

/// Check if a monitor index represents "all monitors" mode
/// Accepts usize::MAX or any value >= 1000000 (JS sends Number.MAX_SAFE_INTEGER)
fn is_all_monitors(idx: usize) -> bool {
    idx == ALL_MONITORS || idx >= 1_000_000
}

impl CaptureManager {
    pub fn new() -> Self {
        Self {
            enabled: true,
            paused: false,
            analysis_fps: 4,
            analysis_scale: 0.15,
            motion_threshold: 20,
            monitor_index: 0,
            prev_frame: None,
            frame_width: 0,
            frame_height: 0,
            region_id_counter: 0,
            tracked_regions: Vec::new(),
            max_missed_frames: 5,
            overlay_masks: Vec::new(),
        }
    }

    pub fn set_config(
        &mut self,
        enabled: bool,
        analysis_fps: u32,
        analysis_scale: f64,
        motion_threshold: u32,
    ) {
        self.enabled = enabled;
        self.analysis_fps = analysis_fps.clamp(1, 15);
        self.analysis_scale = analysis_scale.clamp(0.05, 0.5);
        self.motion_threshold = motion_threshold.clamp(5, 80);
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused;
    }

    /// Set the overlay masks in canvas (virtual-desktop physical) coords.
    /// Pass an empty vec to disable masking (e.g. when the overlay is hidden
    /// from capture via WDA_EXCLUDEFROMCAPTURE, the entities are already
    /// invisible to xcap). One rect per visible entity (founder + siblings).
    pub fn set_overlay_masks(&mut self, masks: Vec<OverlayMaskRect>) {
        self.overlay_masks = masks;
    }

    pub fn set_monitor(&mut self, index: usize) {
        self.monitor_index = index;
        self.prev_frame = None; // reset on monitor change
    }

    pub fn should_capture(&self) -> bool {
        self.enabled && !self.paused
    }

    pub fn get_interval(&self) -> Duration {
        Duration::from_millis((1000 / self.analysis_fps.max(1)) as u64)
    }

    pub fn get_monitor_index(&self) -> usize {
        self.monitor_index
    }

    pub fn get_analysis_scale(&self) -> f64 {
        self.analysis_scale
    }

    pub fn get_overlay_masks(&self) -> &[OverlayMaskRect] {
        &self.overlay_masks
    }

    /// Process a captured frame (grayscale, already downscaled) and detect motion regions.
    ///
    /// `frame_masks` is a slice of rectangles (x0, y0, x1, y1) in frame pixel
    /// coordinates (exclusive upper bound) that should be excluded from motion
    /// detection — used to prevent Kovy's own overlay entities (founder +
    /// siblings) from self-detecting when the overlay is visible to screen
    /// capture. Empty slice = no masking.
    pub fn analyze_frame(
        &mut self,
        frame: Vec<u8>,
        width: u32,
        height: u32,
        frame_masks: &[(u32, u32, u32, u32)],
    ) -> Vec<MotionRegion> {
        let threshold = self.motion_threshold as u8;

        if self.frame_width != width || self.frame_height != height {
            self.prev_frame = None;
            self.frame_width = width;
            self.frame_height = height;
        }

        let prev = match &self.prev_frame {
            Some(p) if p.len() == frame.len() => p,
            _ => {
                self.prev_frame = Some(frame);
                return vec![];
            }
        };

        // Compute diff mask
        let mut diff = vec![false; frame.len()];
        for i in 0..frame.len() {
            let d = (frame[i] as i16 - prev[i] as i16).unsigned_abs() as u8;
            diff[i] = d > threshold;
        }

        // Zero out diff inside each overlay mask so Kovy's own rendering
        // (entity bodies, emotes, particles) doesn't self-trigger motion
        // regions. One mask per visible entity (founder + siblings).
        for &(mx0, my0, mx1, my1) in frame_masks {
            let mx0 = mx0.min(width);
            let my0 = my0.min(height);
            let mx1 = mx1.min(width);
            let my1 = my1.min(height);
            if mx0 < mx1 && my0 < my1 {
                for py in my0..my1 {
                    let row_start = (py * width + mx0) as usize;
                    let row_end = (py * width + mx1) as usize;
                    for idx in row_start..row_end {
                        if idx < diff.len() {
                            diff[idx] = false;
                        }
                    }
                }
            }
        }

        // Simple connected-component labeling via grid cells
        let cell_size = 16u32;
        let cols = (width + cell_size - 1) / cell_size;
        let rows = (height + cell_size - 1) / cell_size;

        let mut regions: Vec<MotionRegion> = Vec::new();

        for cy in 0..rows {
            for cx in 0..cols {
                let x0 = cx * cell_size;
                let y0 = cy * cell_size;
                let x1 = (x0 + cell_size).min(width);
                let y1 = (y0 + cell_size).min(height);

                let mut count = 0u32;
                let mut energy_sum = 0u64;

                for py in y0..y1 {
                    for px in x0..x1 {
                        let idx = (py * width + px) as usize;
                        if idx < diff.len() && diff[idx] {
                            count += 1;
                            energy_sum +=
                                (frame[idx] as i16 - prev[idx] as i16).unsigned_abs() as u64;
                        }
                    }
                }

                let cell_area = (x1 - x0) * (y1 - y0);
                let fill_ratio = count as f64 / cell_area.max(1) as f64;

                // Only emit regions with significant motion
                if fill_ratio > 0.15 && count > 4 {
                    self.region_id_counter = self.region_id_counter.wrapping_add(1);
                    let avg_energy = energy_sum as f64 / count.max(1) as f64;

                    regions.push(MotionRegion {
                        id: self.region_id_counter,
                        centroid: Centroid {
                            x: (x0 as f64 + x1 as f64) / 2.0,
                            y: (y0 as f64 + y1 as f64) / 2.0,
                        },
                        bounding_box: BoundingBox {
                            x: x0,
                            y: y0,
                            w: x1 - x0,
                            h: y1 - y0,
                        },
                        area: count,
                        energy: avg_energy,
                        persistence: 1,
                        novelty: 1.0,
                        score: 0.0, // scored on frontend
                    });
                }
            }
        }

        // Merge adjacent high-activity cells into larger regions
        let merged = merge_nearby_regions(regions, cell_size as f64 * 1.5);

        // --- Stable temporal tracking ---
        // Match merged detections to existing tracks via greedy nearest-centroid distance
        let tracked = self.match_and_track(merged);

        self.prev_frame = Some(frame);
        tracked
    }

    /// Match new detections against existing tracked regions.
    /// Uses greedy nearest-centroid distance matching.
    /// Assigns stable IDs that persist across frames.
    fn match_and_track(&mut self, detections: Vec<MotionRegion>) -> Vec<MotionRegion> {
        let max_match_dist = 40.0; // max centroid distance for matching

        // Mark all existing tracks as potentially missed this frame
        let mut track_matched = vec![false; self.tracked_regions.len()];
        let mut det_matched = vec![false; detections.len()];
        let mut result: Vec<MotionRegion> = Vec::new();

        // Greedy matching: for each detection, find the closest unmatched track
        for (di, det) in detections.iter().enumerate() {
            let mut best_ti: Option<usize> = None;
            let mut best_dist = f64::MAX;

            for (ti, track) in self.tracked_regions.iter().enumerate() {
                if track_matched[ti] {
                    continue;
                }
                let dx = det.centroid.x - track.centroid.x;
                let dy = det.centroid.y - track.centroid.y;
                let dist = (dx * dx + dy * dy).sqrt();
                if dist < max_match_dist && dist < best_dist {
                    best_dist = dist;
                    best_ti = Some(ti);
                }
            }

            if let Some(ti) = best_ti {
                // Matched: update the existing track
                track_matched[ti] = true;
                det_matched[di] = true;
                let track = &mut self.tracked_regions[ti];
                track.centroid = det.centroid.clone();
                track.bounding_box = det.bounding_box.clone();
                track.area = det.area;
                track.energy = track.energy * 0.7 + det.energy * 0.3; // smoothed
                track.age += 1;
                track.missed = 0;
                track.persistence += 1;

                let novelty = if track.persistence < 5 {
                    1.0
                } else {
                    (1.0 - (track.persistence as f64 / 30.0).min(1.0)).max(0.1)
                };
                result.push(MotionRegion {
                    id: track.id,
                    centroid: track.centroid.clone(),
                    bounding_box: track.bounding_box.clone(),
                    area: track.area,
                    energy: track.energy,
                    persistence: track.persistence,
                    novelty,
                    score: 0.0,
                });
            }
        }

        // Create new tracks for unmatched detections
        for (di, det) in detections.iter().enumerate() {
            if det_matched[di] {
                continue;
            }
            self.region_id_counter = self.region_id_counter.wrapping_add(1);
            let new_track = TrackedRegion {
                id: self.region_id_counter,
                centroid: det.centroid.clone(),
                bounding_box: det.bounding_box.clone(),
                area: det.area,
                energy: det.energy,
                age: 0,
                missed: 0,
                persistence: 1,
            };
            result.push(MotionRegion {
                id: new_track.id,
                centroid: new_track.centroid.clone(),
                bounding_box: new_track.bounding_box.clone(),
                area: new_track.area,
                energy: new_track.energy,
                persistence: 1,
                novelty: 1.0,
                score: 0.0,
            });
            self.tracked_regions.push(new_track);
        }

        // Increment missed count for unmatched tracks, remove stale ones
        for (ti, matched) in track_matched.iter().enumerate() {
            if !matched {
                self.tracked_regions[ti].missed += 1;
            }
        }
        self.tracked_regions
            .retain(|t| t.missed <= self.max_missed_frames);

        // Cap tracked regions to avoid unbounded growth
        if self.tracked_regions.len() > 30 {
            self.tracked_regions
                .sort_by(|a, b| b.persistence.cmp(&a.persistence));
            self.tracked_regions.truncate(30);
        }

        // Sort result by area descending and cap at 20
        result.sort_by(|a, b| b.area.cmp(&a.area));
        result.truncate(20);
        result
    }
}

/// Merge regions whose centroids are within `max_dist` of each other
fn merge_nearby_regions(regions: Vec<MotionRegion>, max_dist: f64) -> Vec<MotionRegion> {
    if regions.len() <= 1 {
        return regions;
    }

    // Simple greedy merge
    let mut merged: Vec<MotionRegion> = Vec::new();
    let mut used = vec![false; regions.len()];

    for i in 0..regions.len() {
        if used[i] {
            continue;
        }
        let mut group = vec![i];
        used[i] = true;

        for j in (i + 1)..regions.len() {
            if used[j] {
                continue;
            }
            let dx = regions[i].centroid.x - regions[j].centroid.x;
            let dy = regions[i].centroid.y - regions[j].centroid.y;
            if (dx * dx + dy * dy).sqrt() < max_dist {
                group.push(j);
                used[j] = true;
            }
        }

        if group.len() == 1 {
            merged.push(regions[i].clone());
        } else {
            // Merge into single region
            let mut total_area = 0u32;
            let mut cx_sum = 0.0f64;
            let mut cy_sum = 0.0f64;
            let mut energy_sum = 0.0f64;
            let mut min_x = u32::MAX;
            let mut min_y = u32::MAX;
            let mut max_x = 0u32;
            let mut max_y = 0u32;

            for &idx in &group {
                let r = &regions[idx];
                total_area += r.area;
                cx_sum += r.centroid.x * r.area as f64;
                cy_sum += r.centroid.y * r.area as f64;
                energy_sum += r.energy * r.area as f64;
                min_x = min_x.min(r.bounding_box.x);
                min_y = min_y.min(r.bounding_box.y);
                max_x = max_x.max(r.bounding_box.x + r.bounding_box.w);
                max_y = max_y.max(r.bounding_box.y + r.bounding_box.h);
            }

            merged.push(MotionRegion {
                id: regions[group[0]].id,
                centroid: Centroid {
                    x: cx_sum / total_area.max(1) as f64,
                    y: cy_sum / total_area.max(1) as f64,
                },
                bounding_box: BoundingBox {
                    x: min_x,
                    y: min_y,
                    w: max_x - min_x,
                    h: max_y - min_y,
                },
                area: total_area,
                energy: energy_sum / total_area.max(1) as f64,
                persistence: 1,
                novelty: 1.0,
                score: 0.0,
            });
        }
    }

    // Cap at 20 regions, sorted by area descending
    merged.sort_by(|a, b| b.area.cmp(&a.area));
    merged.truncate(20);
    merged
}

pub fn list_monitors() -> Vec<MonitorInfo> {
    let monitors = match xcap::Monitor::all() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Kovy: Failed to list monitors: {}", e);
            return vec![];
        }
    };

    monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i,
            name: m.name().to_string(),
            width: m.width(),
            height: m.height(),
            x: m.x(),
            y: m.y(),
            is_primary: m.is_primary(),
        })
        .collect()
}

pub fn run_capture_loop(app: tauri::AppHandle, capture: Arc<Mutex<CaptureManager>>) {
    loop {
        let (should_capture, interval, monitor_idx, scale, overlay_masks) = {
            let cap = capture.lock();
            (
                cap.should_capture(),
                cap.get_interval(),
                cap.get_monitor_index(),
                cap.get_analysis_scale(),
                cap.get_overlay_masks().to_vec(),
            )
        };

        if !should_capture {
            std::thread::sleep(Duration::from_millis(200));
            continue;
        }

        let start = Instant::now();

        // Capture screen
        let monitors = match xcap::Monitor::all() {
            Ok(m) => m,
            Err(_) => {
                std::thread::sleep(interval);
                continue;
            }
        };

        // Handle "all monitors" mode: stitch all monitors into one virtual desktop frame
        if is_all_monitors(monitor_idx) {
            if monitors.is_empty() {
                std::thread::sleep(interval);
                continue;
            }

            // Compute virtual desktop bounds
            let mut min_x = i32::MAX;
            let mut min_y = i32::MAX;
            let mut max_x = i32::MIN;
            let mut max_y = i32::MIN;
            for m in &monitors {
                min_x = min_x.min(m.x());
                min_y = min_y.min(m.y());
                max_x = max_x.max(m.x() + m.width() as i32);
                max_y = max_y.max(m.y() + m.height() as i32);
            }
            let vd_w = (max_x - min_x) as u32;
            let vd_h = (max_y - min_y) as u32;

            // Capture each monitor and composite onto virtual desktop
            let mut composite = image::RgbaImage::new(vd_w, vd_h);
            let mut any_ok = false;
            for m in &monitors {
                if let Ok(img) = m.capture_image() {
                    let off_x = (m.x() - min_x).max(0) as u32;
                    let off_y = (m.y() - min_y).max(0) as u32;
                    image::imageops::overlay(&mut composite, &img, off_x as i64, off_y as i64);
                    any_ok = true;
                }
            }

            if !any_ok {
                std::thread::sleep(interval);
                continue;
            }

            // Downscale and convert to grayscale
            let new_w = ((vd_w as f64) * scale).max(1.0) as u32;
            let new_h = ((vd_h as f64) * scale).max(1.0) as u32;
            let resized = image::imageops::resize(&composite, new_w, new_h, image::imageops::FilterType::Nearest);

            let gray: Vec<u8> = resized
                .pixels()
                .map(|p| {
                    let r = p[0] as u32;
                    let g = p[1] as u32;
                    let b = p[2] as u32;
                    ((r * 299 + g * 587 + b * 114) / 1000) as u8
                })
                .collect();

            let regions = {
                // All-monitors mode: frame covers the full virtual desktop, so
                // canvas coords map directly to frame coords via the scale.
                let frame_masks: Vec<(u32, u32, u32, u32)> = overlay_masks
                    .iter()
                    .map(|m| {
                        let s = scale as f32;
                        (
                            (m.x * s) as u32,
                            (m.y * s) as u32,
                            ((m.x + m.w) * s) as u32,
                            ((m.y + m.h) * s) as u32,
                        )
                    })
                    .collect();
                let mut cap = capture.lock();
                cap.analyze_frame(gray, new_w, new_h, &frame_masks)
            };

            let payload = MotionAnalysisPayload {
                regions,
                capture_width: vd_w,
                capture_height: vd_h,
                monitor_width: vd_w,
                monitor_height: vd_h,
            };
            let _ = app.emit("motion-analysis", &payload);

            let elapsed = start.elapsed();
            if elapsed < interval {
                std::thread::sleep(interval - elapsed);
            }
            continue;
        }

        let monitor = match monitors.get(monitor_idx) {
            Some(m) => m,
            None => {
                if let Some(m) = monitors.first() {
                    m
                } else {
                    std::thread::sleep(interval);
                    continue;
                }
            }
        };

        let image = match monitor.capture_image() {
            Ok(img) => {
                // Log dimension mismatch (DPI scaling) — helps diagnose
                // "part of monitor not captured" issues on high-DPI setups.
                let img_w = img.width();
                let img_h = img.height();
                let mon_w = monitor.width();
                let mon_h = monitor.height();
                if img_w != mon_w || img_h != mon_h {
                    eprintln!(
                        "Kovy capture: DPI scale detected — monitor {} reports {}×{}, capture is {}×{} (scale {:.2}×{:.2})",
                        monitor_idx,
                        mon_w, mon_h,
                        img_w, img_h,
                        img_w as f64 / mon_w as f64,
                        img_h as f64 / mon_h as f64,
                    );
                }
                img
            }
            Err(_) => {
                std::thread::sleep(interval);
                continue;
            }
        };

        // Downscale and convert to grayscale
        let orig_w = image.width();
        let orig_h = image.height();
        let new_w = ((orig_w as f64) * scale).max(1.0) as u32;
        let new_h = ((orig_h as f64) * scale).max(1.0) as u32;

        let resized =
            image::imageops::resize(&image, new_w, new_h, image::imageops::FilterType::Nearest);

        let gray: Vec<u8> = resized
            .pixels()
            .map(|p| {
                let r = p[0] as u32;
                let g = p[1] as u32;
                let b = p[2] as u32;
                ((r * 299 + g * 587 + b * 114) / 1000) as u8
            })
            .collect();

        // Analyze
        let regions = {
            // Single-monitor mode: the frame covers only this monitor. The
            // overlay masks are in virtual-desktop canvas coords, so subtract
            // the monitor's offset within the virtual desktop before scaling.
            // Virtual desktop origin across all monitors
            let (vd_min_x, vd_min_y) = monitors.iter().fold(
                (i32::MAX, i32::MAX),
                |(ax, ay), mm| (ax.min(mm.x()), ay.min(mm.y())),
            );
            let mon_off_x = (monitor.x() - vd_min_x) as f32;
            let mon_off_y = (monitor.y() - vd_min_y) as f32;
            let s = scale as f32;
            let frame_masks: Vec<(u32, u32, u32, u32)> = overlay_masks
                .iter()
                .map(|m| {
                    let x0 = ((m.x - mon_off_x) * s).max(0.0) as u32;
                    let y0 = ((m.y - mon_off_y) * s).max(0.0) as u32;
                    let x1 = ((m.x + m.w - mon_off_x) * s) as u32;
                    let y1 = ((m.y + m.h - mon_off_y) * s) as u32;
                    (x0, y0, x1.min(new_w), y1.min(new_h))
                })
                .collect();
            let mut cap = capture.lock();
            cap.analyze_frame(gray, new_w, new_h, &frame_masks)
        };

        // Always emit — even when empty — so frontend can clear stale targets
        let mon_w = monitor.width();
        let mon_h = monitor.height();
        let payload = MotionAnalysisPayload {
            regions,
            capture_width: orig_w,
            capture_height: orig_h,
            monitor_width: mon_w,
            monitor_height: mon_h,
        };
        let _ = app.emit("motion-analysis", &payload);

        // Sleep remaining time
        let elapsed = start.elapsed();
        if elapsed < interval {
            std::thread::sleep(interval - elapsed);
        }
    }
}
