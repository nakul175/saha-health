import type { Visit } from './types';

export type LocalUrgentRoute = {
  checkId: string;
  evaluatedAt: string;
  protocolPins: { id: string; manifestHash: string; revision: number; title: string }[];
  findings: {
    entryId: string;
    ruleId: string;
    label: string;
    action: string;
    service: { id: string; title: string; contactRoute: string; location: string };
  }[];
};

// A saved protocol evaluation contains the approved action, local service contact and
// exact protocol manifests used at evaluation time. Reading it never invokes AI, MIS,
// or another network service. It is deliberately limited to the current, non-voided
// visit and omits evaluations that a clinician explicitly rejected.
export function localUrgentRoute(visit: Visit): LocalUrgentRoute | null {
  if (visit.voidedAt || visit.supersededBy) return null;
  const check = [...(visit.protocolChecks ?? [])].reverse().find(candidate =>
    candidate.decision?.decision !== 'rejected' &&
    candidate.findings.some(finding => finding.urgency === 'urgent_review'),
  );
  if (!check) return null;
  const findings = check.findings.filter(finding => finding.urgency === 'urgent_review').map(finding => ({
    entryId: finding.entryId,
    ruleId: finding.ruleId,
    label: finding.label,
    action: finding.action,
    service: { ...finding.service },
  }));
  return {
    checkId: check.id,
    evaluatedAt: check.at,
    protocolPins: check.protocols.map(protocol => ({ ...protocol })),
    findings,
  };
}
