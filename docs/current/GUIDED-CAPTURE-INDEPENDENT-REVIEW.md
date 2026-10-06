# Independent guided visit review — clearance held

Cold author source `b09396fb10e031ea95f29ba93c6a2f5d7197718e`, source base `857f4ee8`. Author before evidence, source and final reports remain unchanged. This commit changes only independent drivers, evidence and this review.

Fresh build/types and all 125 original positive Chromium/Worker assertions pass: 48 core guided visit, 11 governed installed conditional fact, 15 actual accepted-save lost acknowledgement, 33 Home, and 18 legacy pointer/mouse/keyboard unusual-range first-save assertions. Driver wrappers change evidence custody and isolated runtime names/ports only. Current identity/notices and original permissions remain present; mounted step state, paired BP, source/time/units/reasons, conditional pruning, explicit saves/current patient review and role/purpose/CAS/range refusal checks pass. Original conditional/clinical rule and protocol approval limits remain.

## P2: explicit unchanged-revision Load saved record does not reset programme answers

An additional actual Chromium/Worker probe selects cough=Yes in a pinned TB programme, then aborts the first `saveProgrammeAnswers` request before server dispatch. Its exact original body and key are retained, one POST is observed, and the app visibly reports an unconfirmed outcome and disables another programme save. The original saved visit is revision 1 with answers `{}`. Before the user makes a deliberate choice, local Yes correctly remains on screen and a scoped current-record read does not resend a mutation.

The user then explicitly chooses **Load saved record** from the current comparison at that same revision. The programme cough selector still shows **Yes**, although the saved answer is absent and should render **Not answered**. The unchanged intended reset assertion fails. Exact JSON/screenshot and initial assertion log are retained in `programme-current-read/programme-after-load.json/.png` and `programme-read.log`. This probe has zero accepted assertions; its four preliminary positives are not added to the 125 baseline total.

Affected source: `app/workspace.tsx` `acceptConflict` clears uncertainty and replaces facts, but does not signal a programme state reset; `app/programmes.tsx` `ProgrammeQuestions` resets local answers/absence only on `[v.id,v.version]`. No version change occurs in this readback. A narrow explicit reset signal must apply to deliberate Load while keeping step navigation mounted, preserving local edits before that choice, and retaining appropriate local programme edits on deliberate merge. It must not write, guess outcome, retry or change the original command key/body.

Clearance is held until the unchanged intended reset probe passes on a separate independently reviewed source repair. No source repair, canonical edit, push or provider call was made here. Ordinary read-only exact command receipt lookup and durable tab-close recovery remain inherited software limits; current saved-record comparison is not falsely labelled receipt lookup. Clinical/translation/physical Android/external acceptance remains pending.

Evidence custody is pinned in `tests/evidence/guided-capture-independent/manifest.json`.
