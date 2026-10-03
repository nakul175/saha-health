# Remaining work estimate

2 October 2026 IST, after the third merge into `main` (#74–#99). The sponsor asked what share of development is done. This page records the answer and how it was reached. It is an estimate for planning, not an acceptance measure: no figure here changes the status of any requirement.

## Measured

From `requirements/assessment.tsv` on `main` (33e69cd): of 176 BRD v1.1 requirements, 0 are formally accepted, 14 are implemented locally, 151 are partial, 2 are not built and 9 are unverified. 165 of 176 (94%) have some code in place; 14 (8%) are complete in local code.

## What remains, by who can close it

The "remaining" column of each requirement was read twice and given one class:

- **BUILD**: at least one remaining item is software the team can write now, against synthetic data and mock partners.
- **EXTERNAL**: nothing remaining is buildable alone; something needs an outside party's input, approval, specification, credentials or policy (partners, providers, ABDM, clinicians, buyer, legal).
- **VALIDATION**: nothing remaining is buildable alone; what remains is testing, measurement, real-device or field trials, or independent review.

One reading was made by the agent that built the overnight slices; the other was made blind by a separate agent given only the remaining-work text.

| Class | Builder reading | Independent reading |
| --- | ---: | ---: |
| BUILD | 94 | 99 |
| EXTERNAL | 57 | 50 |
| VALIDATION | 25 | 27 |

The readings give the same class for 156 of 176 requirements and the same build/not-build call for 159. Both call 88 requirements BUILD; at least one calls 105 BUILD. So 71 to 88 requirements (40–50%) cannot be finished by writing code. Files: [builder reading](remaining-work/classification-builder.tsv), [independent reading](remaining-work/classification-independent.tsv).

## Remaining buildable slices

The independent agent grouped the buildable items into slices of the size already delivered, merging items that would ship together across requirements (one scheduled-trigger slice, one out-of-app notification slice). [Proposed slices](remaining-work/remaining-slices.tsv): 75 with generous grouping, 103 with strict grouping plus four borderline items.

`docs/NEXT-DELIVERY.md` lists 86 delivered slices: 75 feature slices and 11 fix-only slices after reviews (3c, 6p, 6q, 6r, 6u, 6w, 6z, 6aa, 6ab, 6ad, 6ae). At that ratio (about one fix slice per seven feature slices) the remaining feature slices bring 11 to 15 fix slices; the ratio may be higher for the remaining authorisation, background and integration work.

Share of feature work since the slice programme began that is done: 75 of 150 (50%) with generous grouping, 75 of 178 (42%) with strict grouping. Work in releases R1–R11 is not counted in slices, so this is not a share of all code ever written. The overnight build of 1–2 October delivered 19 feature slices; at that pace the remaining buildable work is roughly four to six further nights of the same kind, before human review.

## Update after round 10 (3 October 2026 IST)

Since the estimate above, `main` gained the demonstration slices 9a–9c (built for the sponsor's demonstration, not on the proposed list), round 10 (feature slices 10a–10j) and the review-fix slice 10k. By name, eight of the round-10 slices close proposed slices R01, R02, R07, R10, R16 (without the ABHA checksum), R20, R31 and R36; 10c (incentive claims) and 10j (Hindi workspace) cover requirement work without a single matching row. On that reading about 67 proposed slices remain with generous grouping and about 95 with strict grouping, and, counting only those eight, the share of feature work since the slice programme began rises to about 55% (83 of 150) or 47% (83 of 178). Requirement counts are unchanged (14 / 151 / 2 / 9), because every round-10 requirement still has remaining work. The mapping was made by name by the agent that integrated round 10 and was not checked by anyone else.

## Limits

- Judgement from one-line remaining-work text, without reading the code. Slice size varies widely (3f is small, 4f is large); this alone could move the count by about 15.
- Items built against mock partners or mock ABDM may need rework when real specifications arrive; that rework is not counted.
- No person has reviewed the classification or the slice grouping.
