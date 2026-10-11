# AI/ML evaluation and assurance
Apply when AI affects delivered behavior, including third-party models, classifiers, ranking, retrieval and agent tools. If unknown, resolve applicability before dependent release decisions. Link the canonical AI assurance record instead of duplicating it.

## Evaluation design
Declare use case, user population, decision authority, prohibited actions, human review, failure cost and fallback. Pin model/provider/version, parameters, system/user prompt templates, tool definitions, retrieval corpus/index, code, feature pipeline and dataset hashes. Provider changes can invalidate evidence even without code changes.

Separate development, validation and held-out test data; prevent train/test and prompt-tuning leakage. Document provenance, consent/licensing, labeling rubric, reviewer expertise/agreement, duplicates, representativeness, exclusions and missing labels. Slice by meaningful users/languages/conditions and intersecting vulnerable groups where appropriate and authorized. Synthetic data supplements evidence; it does not establish real-world representativeness.

| Dimension | Suggested measure / required design |
|---|---|
| Classification | Precision/recall per class, confusion matrix, calibration; harm-weighted errors |
| Regression/scoring | Error distribution, systematic bias, agreement and relevant tolerance |
| Retrieval | Recall at chosen k, relevance and source freshness |
| Generative output | Rubric for correctness, grounding, completeness and supported abstention |
| Safety | Unsafe advice/action, sensitive disclosure, injection/tool abuse, fallback effectiveness |
| Fairness | Slice outcomes and disparities with sample sizes/uncertainty |
| Operational | Latency, cost per accepted outcome, availability and fallback quality |

Predeclare targets, baseline, sample-size rationale, confidence bounds, repeated-run count and regression rules. For stochastic outputs preserve per-run results and distributions; don't cherry-pick outputs or optimize on the held-out test. Use human-calibrated judging; record judge model/prompt/version and inter-rater checks. Judge scores are evidence with limitations, not ground truth or independent approval.

## Safety and agent controls
Evaluate direct and retrieved prompt injection, exfiltration, tool permissions, argument validation, cross-tenant retrieval, unsupported claims, refusal/abstention, human escalation, duplicate tool actions and denial side effects. Include multilingual, adversarial, ambiguous and out-of-distribution inputs. Unsafe or unauthorized irreversible actions block release regardless of average quality.

## Regression and production
Compare candidate with baseline on the same pinned dataset and slices; review changed examples and confidence, not only aggregate scores. Monitoring tracks input drift, outcome quality, harm, cost, latency and version changes with data-minimizing telemetry. Define feedback labeling, escalation, fallback/kill switch and rollback owner. Unavailable model pinning requires recorded provider controls, revalidation trigger and residual-risk decision.
