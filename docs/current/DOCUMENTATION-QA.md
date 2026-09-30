# Documentation verification record

Edition 1.1 · 28 September 2026 · reconciled to application R11 / v1.3-readiness. These are documentation checks, not a new product qualification run or formal acceptance.

| Check | Result and boundary |
| --- | --- |
| Application baseline | All 261 pre-existing files other than the deliberately replaced README retain their SHA-256 hashes. Runtime, migrations, dependencies/lockfile, release notes, requirements and saved product results are unchanged. The previous README is archived. |
| Original documents | 91 original files retained, including both ZIP archives, eleven Word files counting the source BRD, one workbook, prototype and engineering assets. Extracted pack entries are compared byte-for-byte with the original archives; CRC and Office XML structure checked. |
| Requirements | All 176 exact source IDs and clauses retained; current 14/134/19/9 assessments unchanged; 176 pending and zero accepted. Evidence paths resolve. |
| Tests | All 364 original catalogue records and every original field retained. Additional columns identify related engineering context without marking formal cases passed. |
| Workbook | All 13 sheets exported for review; all 380 original formulas and their cached values retained in the export manifest. Original workbook bytes preserve formatting and validations. No workbook edit, recalculation or new Excel execution is claimed. |
| Specifications | Ten full Word paragraph/table transcriptions accompany ten current reconciled specifications and a current BRD record. Original visual formatting remains in the unchanged Word files; no newly rendered DOCX edition is claimed. |
| API and data | 13 HTTP route pairs, 108 command schema discriminators, 24 application tables, 133 SQL columns and six migrations reconciled to source. Counts do not imply full target API, RLS or normalized data-model delivery. |
| Wireframe and UI | All 22 original screen contracts mapped to current modules/gaps; 14 current navigation entries listed. Annotated prototype preserves the original script. Its 37 state/markup checks pass using a minimal DOM stub; this is not browser visual/accessibility qualification. |
| Setup | Fresh local D1 initialization applies the six actual Drizzle migration files using the documented built-config approach. The temporary synthetic database is removed afterward. No hosted migration or full application rerun is part of this check. |
| Current links and generated views | Relative links, source locations, generated-file consistency, archive digests and evidence report hashes checked by the committed checker. Historical links retain their original context. |

Run `python3 scripts/check-documentation.py` and `node scripts/audit-requirements.mjs --check`. The first command checks the R11 baseline, so a later code release must deliberately add its own baseline and update the checker rather than silently replace historical evidence.

Machine evidence: [verification result](../verification/verification.json), [generated inventory](../verification/generated-inventory.json), [prototype checks](../verification/wireframe-check.json), [application baseline](../verification/application-r11-sha256.json), and [original document hashes](../verification/original-documents-sha256.json).

The saved 1,284 R11 product assertions remain historical 27 September evidence. Live partners/providers, representative clinical/model evaluation, actual disconnected devices, independent security/accessibility, scale, hosted recovery and real-world pilot acceptance remain open. GitHub publication is version control, not approval of those gates.
