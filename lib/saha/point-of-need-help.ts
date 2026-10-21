export const POINT_OF_NEED_HELP_SOURCE = Object.freeze({
  id: 'saha-routine-task-guidance',
  label: 'Saha routine-task guidance',
  version: '1.0',
  provenance: 'Internal procedural guidance; no external provider or clinical content.',
});

export type PointOfNeedHelp =
  | { kind: 'available'; title: string; instructions: readonly string[]; manualPath: string; source: typeof POINT_OF_NEED_HELP_SOURCE }
  | { kind: 'unavailable'; message: string; manualPath: string; source: typeof POINT_OF_NEED_HELP_SOURCE }
  | { kind: 'refused'; message: string; manualPath: string };

const MANUAL_PATH = 'Close help and continue the current form, or return to Today. Help never saves, confirms, assigns or sends work.';
const MEASURES = new Set(['bloodPressure', 'weight', 'temperature', 'weeks', 'coughDays']);

function topic(step: string): { title: string; instructions: readonly string[] } | null {
  if (step === 'time') return {
    title: 'Observation time and source',
    instructions: [
      'Record when the observation was made and whether it was measured or reported.',
      'Use the explicit missing reason when a value was not recorded. Do not guess a value or status.',
    ],
  };
  if (step.startsWith('fact:') && MEASURES.has(step.slice(5))) return {
    title: 'Record this observation',
    instructions: [
      'Enter only the value that was measured or reported, with its source and observation time.',
      'If no value is available, leave it blank and choose the applicable missing reason. This help does not interpret the result.',
    ],
  };
  if (step === 'notes') return {
    title: 'Visit notes',
    instructions: [
      'Record relevant reported history or your own observation in plain language.',
      'Do not use this guidance to create a diagnosis, patient fact, escalation or completion status.',
    ],
  };
  if (/^programme:[a-z][a-z0-9_-]{0,79}$/.test(step)) return {
    title: 'Programme question',
    instructions: [
      'Answer only the currently installed programme question shown on this task.',
      'If the answer is unavailable, use the offered absence choice or leave the evidence unsaved and continue manually.',
    ],
  };
  if (step === 'facts-save' || step === 'programme-save' || step === 'review') return {
    title: 'Review before saving',
    instructions: [
      'Review the selected person, sources, times and entered evidence before using the explicit save control.',
      'Saving keeps a draft. Confirmation and any destination action remain separate choices.',
    ],
  };
  return null;
}

export function pointOfNeedHelp(input: { task: string; step: string; actorRole: string; sourceAvailable?: boolean }): PointOfNeedHelp {
  if (input.task !== 'routine-visit' || input.actorRole !== 'asha') return {
    kind: 'refused',
    message: 'Help is not available for this task or account.',
    manualPath: MANUAL_PATH,
  };
  const selected = topic(input.step);
  if (!selected) return {
    kind: 'refused',
    message: 'No approved help applies to this part of the task.',
    manualPath: MANUAL_PATH,
  };
  if (input.sourceAvailable === false) return {
    kind: 'unavailable',
    message: 'Approved task guidance is unavailable. No replacement content or completion status was created.',
    manualPath: MANUAL_PATH,
    source: POINT_OF_NEED_HELP_SOURCE,
  };
  return { kind: 'available', ...selected, manualPath: MANUAL_PATH, source: POINT_OF_NEED_HELP_SOURCE };
}
