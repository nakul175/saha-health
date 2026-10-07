# Blameless postmortem template

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: after each postmortem, if the template missed something.

Copy to `docs/postmortems/YYYY-MM-DD-short-title.md`. Describe systems and decisions, not individuals' faults. Never include patient identifiers, secrets or raw provider payloads.

```markdown
# Postmortem: <title>

Date of incident: · Date written: · Author: · Incident owner: · Severity:
Status: draft | reviewed by <name> on <date>

## Summary
Two or three sentences: what happened, who/what was affected, how long.

## Impact
Environment (synthetic / staging / other), organisations affected, records or receipts affected, external effects (anything already sent).

## Timeline (UTC and IST)
| Time | Event | Evidence reference |
| --- | --- | --- |

## Detection
How we found out. What should have alerted us sooner.

## Root cause and contributing factors
What conditions allowed it. Use "the system allowed", not "X failed to".

## What went well / what went badly / where we got lucky

## Containment and recovery
What was done, which receipts were reconciled, whether any restore was used (log it in RESTORE-TEST-LOG.md as a real restore).

## Action items
| Action | Owner | Due | Tracking (PR / issue) |
| --- | --- | --- | --- |

## Follow-ups to documents
Threat model, runbooks, SLOs, requirement assessments, VALIDATION.md entries updated: yes / no (list).
```
