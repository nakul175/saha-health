// Keep the captured contracts and their provenance; omit plans, provider payloads and unrelated visits.
export function routineVisit(visit) {
    return {
        id: visit.id, personId: visit.personId, version: visit.version, state: visit.state,
        facts: visit.facts, createdAt: visit.createdAt, confirmedAt: visit.confirmedAt,
        recordVersion: visit.recordVersion, aiResults: [], programmeCapture: visit.programmeCapture,
        valueRangeCapture: visit.valueRangeCapture, valueOverrides: visit.valueOverrides,
        overrideConfirmations: visit.overrideConfirmations, factAuthors: visit.factAuthors,
        factReviews: visit.factReviews, noteAuthor: visit.noteAuthor, answerAuthors: visit.answerAuthors,
        entryReviews: visit.entryReviews, patientCheck: visit.patientCheck,
        voidedAt: visit.voidedAt, supersededBy: visit.supersededBy,
    };
}
