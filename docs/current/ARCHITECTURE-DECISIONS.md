# Architecture decision reconciliation

All twelve original ADRs are preserved as design proposals. The R11 column records source-observed implementation, not retrospective approval of a proposal or a new institutional decision.

| ADR | Original choice | R11 disposition |
| --- | --- | --- |
| [ADR01](../history/v1.0/engineering/adrs/ADR01.md) | Use a task-centred mobile flow with person and encounter context fixed | Bounded worker workspace implemented; representative usability pending. |
| [ADR02](../history/v1.0/engineering/adrs/ADR02.md) | Start with a modular service and database-backed outbox workers | Modular server and durable checkpoints implemented; autonomous general workers absent. |
| [ADR03](../history/v1.0/engineering/adrs/ADR03.md) | Persist typed operational entities and transform at adapter boundaries | D1 relational indexes plus JSON documents implemented; full canonical/terminology model pending. |
| [ADR04](../history/v1.0/engineering/adrs/ADR04.md) | Use an Android reference client with encrypted local storage and keystore wrapping | Divergence: browser field notebook; native Android/keystore and physical-device acceptance absent. |
| [ADR05](../history/v1.0/engineering/adrs/ADR05.md) | Separate model planning from deterministic execution and policy | Bounded documentary task schemas and deterministic execution exist; broad clinical planning absent. |
| [ADR06](../history/v1.0/engineering/adrs/ADR06.md) | Use saga-style recovery and evidence-based reconciliation | Separate receipts, uncertainty and lookup implemented locally; real partner acceptance pending. |
| [ADR07](../history/v1.0/engineering/adrs/ADR07.md) | Use append-only clinical fact revisions and approval hashes | Append-only revisions and bound approval checks exist; full retention policy pending. |
| [ADR08](../history/v1.0/engineering/adrs/ADR08.md) | Activate provider and model version per deployment and scope | R11 immutable manifests, independent review, scope/date/dependency checks; live intended-use evidence pending. |
| [ADR09](../history/v1.0/engineering/adrs/ADR09.md) | Implement ABDM and direct EHR as separate connector types | Direct EHR foundation exists; ABHA HIP/HIU and ABDM consent exchange absent. |
| [ADR10](../history/v1.0/engineering/adrs/ADR10.md) | Use service policy and tenant RLS with separate runtime roles | Divergence: application policy and D1 CAS; proposed PostgreSQL RLS/service roles absent. |
| [ADR11](../history/v1.0/engineering/adrs/ADR11.md) | Build controlled report projections from versioned domain events | Scoped reports over current organisation state; general versioned event projections absent. |
| [ADR12](../history/v1.0/engineering/adrs/ADR12.md) | Simulators emit mode and source markers and use isolated fixtures | Synthetic fixtures and mode markers retained; external and clinical gates remain open. |

Material choices still requiring review are persistence/scale, native versus browser field custody, institutional identity, sensitive-data separation, real provider/partner contracts and hosted recovery. Record a new dated decision with options, evidence, owner and consequences when one is made; never rewrite the historical proposal as if it had been accepted.
