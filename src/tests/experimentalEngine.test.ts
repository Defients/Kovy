import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentalEngine } from '@/engine/experimentalEngine';
import { DEFAULT_CONFIG } from '@/store/defaults';
import type { ExperimentalInputAdapter, InteractionTarget } from '@/engine/experimentalInput';
const target = { id: 'toy:ball', x: 100, y: 100 };
describe('experimental ownership with a fake input adapter', () => {
 let paused: boolean, e: ExperimentalEngine, input: ExperimentalInputAdapter;
 beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z')); paused=false;
  input={lookup:vi.fn(async t=>t),dispatch:vi.fn(async()=>{})}; e=new ExperimentalEngine(input,()=>paused);
  e.updateConfig({...DEFAULT_CONFIG.experimental,enabled:true,optInAcknowledged:true,autoInteract:true,targetMode:'toys',allowedInteractions:['click'],rateLimitSec:5});
  e.updateTargets([target]);
 });
 afterEach(()=>vi.useRealTimers());
 it('dispatches only a supplied companion target, without desktop coordinate guessing', async()=>{
  expect((await e.tryInteract(target,'inspect',false))?.success).toBe(true);
  expect(input.dispatch).toHaveBeenCalledWith(target,'click');
 });
 it('reserves exactly one slot before lookup and cooldown before failure', async()=>{
  let done!: (v: InteractionTarget|null)=>void;
  vi.mocked(input.lookup).mockReturnValue(new Promise(r=>done=r));
  const pending=e.tryInteract(target,'inspect',false);
  expect(await e.tryInteract(target,'inspect',false)).toBeNull();
  vi.advanceTimersByTime(6000);
  expect(await e.tryInteract(target,'inspect',false)).toBeNull();
  expect(input.lookup).toHaveBeenCalledTimes(1); done(null); await pending;
 });
 it('does not dispatch after privacy pause during lookup',async()=>{
  let done!: (v: InteractionTarget|null)=>void;
  vi.mocked(input.lookup).mockReturnValue(new Promise(r=>done=r));
  const pending=e.tryInteract(target,'inspect',false); paused=true; done(target);
  expect(await pending).toBeNull(); expect(input.dispatch).not.toHaveBeenCalled();
 });
 it.each(['disable','destroy','remove target'] as const)('invalidates pending lookup on %s',async(change)=>{
  let done!: (v: InteractionTarget|null)=>void; vi.mocked(input.lookup).mockReturnValue(new Promise(r=>done=r));
  const pending=e.tryInteract(target,'inspect',false);
  if(change==='disable') e.updateConfig({...DEFAULT_CONFIG.experimental,enabled:false});
  if(change==='destroy') e.destroy(); if(change==='remove target') e.updateTargets([]);
  done(target); expect(await pending).toBeNull(); expect(input.dispatch).not.toHaveBeenCalled();
 });
 it('enforces cooldown after dispatch errors and sanitizes the journal',async()=>{
  vi.mocked(input.dispatch).mockRejectedValue(new Error('SECRET-window-title-key'));
  expect((await e.tryInteract(target,'inspect',false))?.success).toBe(false);
  expect(await e.tryInteract(target,'inspect',false)).toBeNull();
  expect(JSON.stringify(e.getLog())).not.toContain('SECRET');
  vi.advanceTimersByTime(5000); await e.tryInteract(target,'inspect',false);
  expect(input.dispatch).toHaveBeenCalledTimes(2);
 });
 it.each([{...target,x:Infinity},{...target,x:-1},{...target,x:10000},{...target,id:'app:window'}])('rejects invalid or out of radius candidates %j',async(t)=>{
  e.updateTargets([t]); expect(await e.tryInteract(target,'inspect',false)).toBeNull(); expect(input.lookup).not.toHaveBeenCalled();
 });
 it('rejects lookup substitution and never treats a window as a verified element',async()=>{
  vi.mocked(input.lookup).mockResolvedValue({...target,id:'window:title'});
  expect(await e.tryInteract(target,'inspect',false)).toBeNull(); expect(input.dispatch).not.toHaveBeenCalled();
 });
 it('leaves app allowlists unavailable even with a configured name',async()=>{
  e.updateConfig({...DEFAULT_CONFIG.experimental,enabled:true,optInAcknowledged:true,autoInteract:true,targetMode:'allowlist',allowedApps:['notepad.exe']});
  expect(await e.tryInteract(target,'inspect',false)).toBeNull();
 });
 it('never sends the legacy space-key action',async()=>{
  e.updateConfig({...DEFAULT_CONFIG.experimental,enabled:true,optInAcknowledged:true,autoInteract:true,targetMode:'toys',allowedInteractions:['type']});
  expect(await e.tryInteract(target,'inspect',false)).toBeNull(); expect(input.dispatch).not.toHaveBeenCalled();
 });
 it('requires explicit opt-in and curious behavior',async()=>{
  expect(await e.tryInteract(target,'nap',false)).toBeNull();
  e.updateConfig({...DEFAULT_CONFIG.experimental,enabled:true,optInAcknowledged:false});
  expect(await e.tryInteract(target,'inspect',false)).toBeNull();
 });
});
