// Fixed metadata only. No patient, visit, ticket, error or URL fields.
export type CaptureBucket='capture-30s'|'capture-2m'|'capture-5m'|'capture-15m'|'capture-over15m';
export type BurdenCode=CaptureBucket|'help-request'|'assisted-completion'|'client-sync-unknown'|'server-sync-success'|'server-sync-replay'|'server-sync-conflict'|'server-sync-refused'|'server-sync-invalid';
export type BurdenConfig={enabled:boolean;version:number;changedAt:string};
