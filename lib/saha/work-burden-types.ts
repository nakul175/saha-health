// Fixed metadata only. No patient, visit, ticket, error or URL fields.
export type CaptureBucket='capture-30s'|'capture-2m'|'capture-5m'|'capture-15m'|'capture-over15m';
export type ActiveStageBucket='correction-30s'|'correction-2m'|'correction-5m'|'correction-15m'|'correction-over15m'|'reconciliation-30s'|'reconciliation-2m'|'reconciliation-5m'|'reconciliation-15m'|'reconciliation-over15m';
export type BurdenCode=CaptureBucket|ActiveStageBucket|'help-request'|'assisted-completion'|'client-sync-unknown'|'server-sync-success'|'server-sync-replay'|'server-sync-conflict'|'server-sync-refused'|'server-sync-invalid';
export type BurdenConfig={enabled:boolean;version:number;changedAt:string};
