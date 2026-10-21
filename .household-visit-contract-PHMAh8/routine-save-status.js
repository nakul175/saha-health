export function routineSaveStatus({ visit, dirty, busy, uncertain, lifecycle }) {
    const entries = uncertain
        ? 'Write outcome unresolved. Check the original attempt before another save.'
        : busy ? 'Operation in progress. Wait for the server result.'
            : dirty ? 'Unsaved changes on this screen.'
                : visit ? 'Entries match the last loaded server record.' : 'No routine draft loaded.';
    const record = !visit ? 'No server draft loaded.'
        : visit.voidedAt ? `Server version ${visit.version}: voided record.`
            : visit.supersededBy ? `Server version ${visit.version}: superseded record.`
                : `Server version ${visit.version}: ${visit.state === 'confirmed' ? 'confirmed encounter' : 'draft awaiting review'}.`;
    return {
        entries,
        record,
        device: 'This screen does not save a durable copy on this device.',
        destination: 'Destination status is not loaded by this screen. No submission or acceptance is claimed.',
        ...(lifecycle ? { lifecycle } : {}),
    };
}
