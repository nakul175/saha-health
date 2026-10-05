export const AVAILABILITY_CADENCE_MS=300000;
export type AvailabilityPeriod={from:string;until:string|null;version:number;dependencyId:string|null;maintenance:boolean};
export type AvailabilityConfig={enabled:boolean;version:number;periods:AvailabilityPeriod[]};
export type AvailabilitySample={org_id:string;slot:number;source:'scheduler'|'manual-http';config_version:number;core:'healthy'|'failed';workflow:'healthy'|'dependency-unavailable'|'not-configured'|'maintenance';latency_ms:number;receipt_hash:string;recorded_at:string};
