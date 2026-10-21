import type { Facts, Person, Visit } from './types';

export type EncounterSummaryItem = { id: string; label: string; value: string };
export type EncounterSummary = {
  confirmed: EncounterSummaryItem[];
  uncertain: EncounterSummaryItem[];
  missing: EncounterSummaryItem[];
  proposedActions: EncounterSummaryItem[];
  nextRequiredStep: string;
};

const labels: Record<string, string> = {
  date: 'Observation time', bloodPressure: 'Blood pressure', weight: 'Weight',
  temperature: 'Temperature', weeks: 'Gestational weeks', coughDays: 'Cough days', notes: 'Visit notes'
};

const relevant = (person: Pick<Person, 'programmes'>) => [
  'date', 'bloodPressure', 'weight', 'temperature',
  ...(person.programmes.includes('Maternal care') ? ['weeks'] : []),
  ...(person.programmes.includes('TB screening') ? ['coughDays'] : []),
  'notes'
];

const valueOf = (facts: Facts, id: string) => id === 'bloodPressure'
  ? (facts.systolic && facts.diastolic ? `${facts.systolic}/${facts.diastolic} mmHg` : '')
  : String(facts[id as keyof Facts] ?? '');

const sourceOf = (facts: Facts, id: string) => {
  if (id === 'date' || id === 'notes') return facts.source;
  const measure = id === 'bloodPressure' ? 'bloodPressure' : id as keyof NonNullable<Facts['provenance']>;
  return facts.provenance?.[measure]?.source ?? facts.source;
};

/** A read-only projection. It never promotes reported, missing or assistant-derived content to confirmed facts. */
export function encounterSummary(visit: Visit, person: Pick<Person, 'programmes'>): EncounterSummary {
  const confirmed: EncounterSummaryItem[] = [], uncertain: EncounterSummaryItem[] = [], missing: EncounterSummaryItem[] = [];
  for (const id of relevant(person)) {
    const value = valueOf(visit.facts, id), source = sourceOf(visit.facts, id), label = labels[id];
    if (!value) {
      const reason = ['not-asked', 'declined', 'unknown', 'not-applicable'].includes(source) ? source.replace('-', ' ') : 'not recorded';
      missing.push({ id, label, value: reason });
    } else if (source === 'measured' && visit.state === 'confirmed') confirmed.push({ id, label, value });
    else uncertain.push({ id, label, value: `${value} · ${source === 'reported' ? 'reported, verify if needed' : 'not yet confirmed'}` });
  }

  const proposedActions: EncounterSummaryItem[] = visit.aiResults.map(result => ({
    id: `ai:${result.id}`,
    label: `${result.providerName} suggestion`,
    value: `${result.text} · ${result.reviewed ? 'reviewed assistant output' : 'requires human review'}; not a confirmed observation`
  }));
  if (visit.plan && ['proposed', 'approved'].includes(visit.plan.state)) proposedActions.push({
    id: `plan:${visit.plan.id}`, label: 'Prepared action plan',
    value: `${visit.plan.purpose} · ${visit.plan.state}; execution is a separate explicit action`
  });

  const nextRequiredStep = missing.length
    ? `Complete ${missing[0].label}.`
    : uncertain.length ? `Review ${uncertain[0].label}.`
    : visit.state === 'draft' ? 'Review the encounter and confirm it.'
    : proposedActions.length ? 'Review the proposed actions separately.'
    : 'No unresolved encounter fields.';
  return { confirmed, uncertain, missing, proposedActions, nextRequiredStep };
}

/** Used by correction UI so one field changes without replacing person context or sibling answers. */
export function updateEncounterFact(facts: Facts, field: keyof Facts, value: Facts[keyof Facts]): Facts {
  return { ...facts, [field]: value };
}
