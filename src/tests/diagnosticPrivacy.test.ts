import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/store/defaults';
import { exportDiagnosticsBundle, recordError, recordBehaviorChange, setDiagnosticsEnabled } from '@/engine/diagnosticsEngine';
it('diagnostic projection excludes arbitrary nested settings and exception sentinels',()=>{
 const config=structuredClone(DEFAULT_CONFIG);
 const sentinel='SECRET-APP-LOCATION-KEY';
 const poison=(value:unknown):unknown=>Array.isArray(value)?[sentinel,...value.map(poison)]:value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,poison(v)])):typeof value==='string'?sentinel:value;
 const poisoned=poison(config) as typeof config;
 poisoned.privacy.diagnosticsIncludeConfig=true;poisoned.privacy.diagnosticsIncludeErrors=true;
 Object.assign(poisoned,{savedProfiles:[{config:{weather:{location:sentinel},allowedApps:[sentinel]}}],shadowConfig:{apiKey:sentinel}});
 setDiagnosticsEnabled(true);recordError(sentinel,sentinel);recordBehaviorChange('wander','inspect',sentinel);
 const exported=exportDiagnosticsBundle(poisoned);
 expect(exported).not.toContain(sentinel);expect(JSON.parse(exported).configSnapshot.aiEnabled).toBe(false);
 expect(JSON.parse(exported).diagnosticEntries.some((e:{type:string})=>e.type==='error')).toBe(true);
 setDiagnosticsEnabled(false);
});
