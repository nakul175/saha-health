# SAHA-130 cross-class QA plan

This plan binds the approved product defaults to the application structures that already exist. It does not supply or simulate a real provider, device attestation, legal approval, or hosted deletion receipt.

| Class | Current application structure | Local QA obligation | External completion evidence |
| --- | --- | --- | --- |
| Patient record | `workspace.people` and dependent visits | A current hold retains the record; an authoritative tombstone prevents the restored patient and dependent visits from becoming available | Approved jurisdiction schedule and minimum retained evidence schema |
| Model output | `visit.aiResults` | Unclassified output is blocked; a current hold retains it; a tombstone prevents restored raw output from becoming available | Per-output clinical classification and approved content-erasure evidence |
| Offline package/cache | `person.fieldLeases` | Unsynced work blocks disposal; key-only erasure remains evidence-pending; authoritative tombstones prevent restored leases becoming available | Device/provider attestation for physical deletion |
| Audit | Immutable audit chain plus disposition policy | Audit tombstones are rejected; unapproved erasure retains content; approved designs remain evidence-pending until detail unavailability is verified | Approved minimum envelope and detail-erasure adapter evidence |
| Export | Governed export state plus disposition policy | Unregistered destinations block disposal; key inaccessibility without destination proof remains evidence-pending | Registered destination owner and authoritative destination deletion evidence |
| Backup | Recovery evidence plus disposition policy | Unverified tombstone-aware restore blocks disposal; key inaccessibility without provider proof remains evidence-pending | Tested recovery window, restore drill and provider generation/replica receipt |

`tests/retention-cross-class-qa-contract.mjs` executes the local obligations above with synthetic data. A passing result proves refusal and restore-filter behavior only. It cannot turn missing external evidence into QA acceptance.
