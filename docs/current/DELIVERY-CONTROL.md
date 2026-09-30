# Delivery control registers

The unchanged 13-sheet [original workbook](../history/v1.0/Health-AI-Delivery-Control-Workbook-v1.0.xlsx) retains its formulas, validations and historical statuses. Current execution and implementation are maintained in separate GitHub-readable registers. No recalculated or updated XLSX is claimed.

| Current register | Purpose |
| --- | --- |
| [Requirements](../../requirements/traceability.csv) | All 176 exact requirements, R11 assessment, remaining work and pending acceptance |
| [Tests](TEST-CATALOGUE.csv) | All 364 original cases with unchanged fields and separately labelled evidence context |
| [Executions](EXECUTION-REGISTER.csv) | Saved suite evidence, hashes, dates and reproduction commands |
| [Screens](SCREEN-COVERAGE.csv) | All 22 original contracts mapped to current code and gaps |
| [Commands](COMMAND-CATALOGUE.csv) and [routes](HTTP-ROUTES.csv) | Current source-derived API surface |
| [Data](DATA-DICTIONARY.csv) | Current physical schema declarations |
| [Acceptance](10_Pilot-and-Release-Acceptance_v1.1.md) | All eight gates remain open |
| [Plan](08_Engineering-Implementation-Plan_v1.1.md) | Delivery sequence and definitions of ready/done |
| [ADRs](ARCHITECTURE-DECISIONS.md) | Twelve preserved proposals reconciled to the running design |

## All original workbook sheets

CSV views below preserve cell text and formulas for review. They are historical, not current execution status. [The export manifest](../reference/workbook/manifest.json) retains formula locations and original cached values. CSV has no workbook formatting, validations or live cross-sheet calculation; use the original XLSX for those features.

| Sheet | Exported rows including headings | CSV |
| --- | ---: | --- |
| Summary | 35 | [Summary.csv](../reference/workbook/Summary.csv) |
| Requirements | 181 | [Requirements.csv](../reference/workbook/Requirements.csv) |
| Test Catalogue | 369 | [Test-Catalogue.csv](../reference/workbook/Test-Catalogue.csv) |
| Engineering Backlog | 181 | [Engineering-Backlog.csv](../reference/workbook/Engineering-Backlog.csv) |
| Work Packages | 16 | [Work-Packages.csv](../reference/workbook/Work-Packages.csv) |
| Screens | 27 | [Screens.csv](../reference/workbook/Screens.csv) |
| Data Dictionary | 412 | [Data-Dictionary.csv](../reference/workbook/Data-Dictionary.csv) |
| API Catalogue | 79 | [API-Catalogue.csv](../reference/workbook/API-Catalogue.csv) |
| Events | 21 | [Events.csv](../reference/workbook/Events.csv) |
| Access Matrix | 25 | [Access-Matrix.csv](../reference/workbook/Access-Matrix.csv) |
| Decisions | 26 | [Decisions.csv](../reference/workbook/Decisions.csv) |
| Release Gates | 13 | [Release-Gates.csv](../reference/workbook/Release-Gates.csv) |
| ADRs | 17 | [ADRs.csv](../reference/workbook/ADRs.csv) |

The original 21 deployment decisions remain open unless an accountable decision is separately recorded. Roles in work packages are responsibility categories, not named people. This handover does not invent approvals, assignments or dates.
