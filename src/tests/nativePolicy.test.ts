import { beforeEach, expect, it, vi } from "vitest";
const ipc = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: ipc, isTauri: () => true }));
import { DEFAULT_CONFIG } from "@/store/defaults";

beforeEach(() => { vi.resetModules(); ipc.mockReset().mockResolvedValue(12); });

it("sends only an applied permission projection; no keys, profiles, locations or shadow config", async () => {
  const { applyNativePolicy } = await import("@/lib/nativePolicy");
  const config = structuredClone(DEFAULT_CONFIG);
  Object.assign(config, { apiKey: "SECRET", shadowConfig: { ai: { enabled: true } } });
  await applyNativePolicy(config);
  expect(ipc).toHaveBeenCalledWith("apply_native_policy", expect.objectContaining({ policy: expect.objectContaining({ aiEnabled: false }) }));
  expect(JSON.stringify(ipc.mock.calls)).not.toContain("SECRET");
});

it("queues runtime updates in order and awaits pause acknowledgement before dispatch", async () => {
  const { syncNativePause, invokeOwnedAI } = await import("@/lib/nativePolicy");
  let release!: () => void;
  ipc.mockImplementation(cmd => cmd === "pause_capture" ? new Promise<void>(r => { release = r; }) : Promise.resolve(12));
  void syncNativePause(true);
  const pending = invokeOwnedAI("ai_chat", { requestId: "chat-test" });
  await vi.waitFor(() => expect(ipc).toHaveBeenCalledWith("pause_capture"));
  expect(ipc.mock.calls.map(c => c[0])).not.toContain("ai_chat");
  release(); await pending;
  expect(ipc).toHaveBeenLastCalledWith("ai_chat", { requestId: "chat-test", revision: 12 });
});

it("aborting during policy lookup never dispatches a request", async () => {
  const { invokeOwnedAI } = await import("@/lib/nativePolicy");
  let release!: (n: number) => void;
  ipc.mockImplementation(() => new Promise<number>(r => { release = r; }));
  const controller = new AbortController();
  const pending = invokeOwnedAI("ai_request", { requestId: "insight" }, controller.signal);
  const rejected = expect(pending).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(ipc).toHaveBeenCalled());
  controller.abort(); release(12); await rejected;
  expect(ipc.mock.calls.map(c => c[0])).not.toContain("ai_request");
});

it("aborting active IPC cancels its native identifier and suppresses even a successful reply", async () => {
  const { invokeOwnedAI } = await import("@/lib/nativePolicy");
  let release!: (reply: string) => void;
  ipc.mockImplementation(cmd => cmd === "ai_chat" ? new Promise<string>(r => { release = r; }) : Promise.resolve(12));
  const controller = new AbortController();
  const pending = invokeOwnedAI("ai_chat", { requestId: "owned-chat" }, controller.signal);
  const rejected = expect(pending).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(ipc).toHaveBeenCalledWith("ai_chat", expect.anything()));
  controller.abort(); release("stale reply"); await rejected;
  expect(ipc).toHaveBeenCalledWith("cancel_ai_request", { requestId: "owned-chat" });
});
