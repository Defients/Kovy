import { beforeEach, describe, expect, it, vi } from 'vitest';
const db=vi.hoisted(()=>({select:vi.fn(),execute:vi.fn(),close:vi.fn()}));
vi.mock('@tauri-apps/plugin-sql',()=>({default:{load:vi.fn(async()=>db)}}));
describe('memory health and real write seam',()=>{
 beforeEach(()=>{vi.resetModules(); db.select.mockReset().mockResolvedValue([{name:'memories'}]);db.execute.mockReset().mockResolvedValue({rowsAffected:1,lastInsertId:7});});
 it('reports readable but degraded when SQL execute is denied, with no raw exception exposure',async()=>{
  db.execute.mockRejectedValue(new Error('SECRET-path-and-SQL')); const m=await import('@/lib/memoryDb');
  const health=await m.checkMemoryHealth(); expect(health.readable).toBe(true);expect(health.writable).toBe(false);expect(health.error).not.toContain('SECRET');
 });
 it('probes without changing data and reports successful inserts',async()=>{
  const m=await import('@/lib/memoryDb');expect((await m.checkMemoryHealth()).writable).toBe(true);
  expect(db.execute.mock.calls[0][0]).toBe('UPDATE memories SET significance = significance WHERE 0');
  const record={entityId:'test',type:'interaction' as const,significance:1,timestamp:0,duration:0,valence:0,stimulation:0,tags:'',appProcess:null,appTitle:null,summary:'fixture',data:null};
  expect(await m.writeMemory(record)).toBe(7);expect(db.execute.mock.calls[1][1]).toContain('fixture');
 });
 it('does not claim deletion succeeded on disk/permission failure',async()=>{
  const m=await import('@/lib/memoryDb'); await m.checkMemoryHealth();db.execute.mockRejectedValue(new Error('disk full SECRET'));
  await expect(m.clearAllMemories()).rejects.toThrow('could not be cleared');expect(m.getMemoryHealth().writable).toBe(false);
 });
 it('does not consider a missing schema available',async()=>{
  db.select.mockResolvedValue([]);const m=await import('@/lib/memoryDb');expect(await m.isMemoryDbAvailable()).toBe(false);
 });
});
