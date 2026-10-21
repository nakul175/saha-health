/** Read-only chronology. Missing legacy custody is exposed, never inferred from today's provider. */
export function providerResultHistory(results) {
    return results.map(r => ({
        id: r.id, provider: r.providerSnapshot?.name ?? r.providerName, model: r.providerSnapshot?.model ?? 'not retained',
        integrationVersion: r.providerSnapshot?.integrationVersion ?? null, contractVersion: r.providerSnapshot?.contractVersion ?? null,
        status: r.status, originalOutput: r.outputSnapshot?.original ?? r.text, createdAt: r.createdAt,
        observedAt: [...(r.inputSnapshot?.observedAt ?? [])], inputHash: r.inputSnapshot?.hash ?? r.inputHash,
        outputHash: r.outputSnapshot?.hash ?? null, reviewState: r.review?.state ?? (r.reviewed ? 'reviewed' : 'unreviewed'),
        reviewedAt: r.review?.at ?? null, legacy: !r.providerSnapshot || !r.inputSnapshot || !r.outputSnapshot
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
/** Juxtaposition metadata only: it deliberately produces no winner, equivalence or clinical conclusion. */
export function independentComparison(results) {
    const rows = providerResultHistory(results);
    return { rows, providers: [...new Set(rows.map(r => `${r.provider} · ${r.model}`))], comparable: false, selected: null, clinicalUse: false };
}
