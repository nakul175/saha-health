# Security policy

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change of contact, supported environment or disclosure process.

## Scope and status

Saha is a private, synthetic engineering implementation. It is not accepted for production or real patient use ([README](README.md), [HANDOVER](HANDOVER.md)). Do not enter real patient information into any deployment. Reports about the synthetic staging copies and the source code are in scope.

## Reporting a vulnerability

- Email **nakul.jain@aplyd.com** with the subject `Saha security report`.
- Include: what you found, where (URL, route or file), steps to reproduce, the commit or build if known, and the impact you believe it has.
- Do not post details in a public issue or pull request. Do not include real personal data or credentials in the report; describe them instead.
- Test only against synthetic data and only with accounts you were given. Do not attempt denial of service, social engineering or access to other people's data.

## What to expect

No response time, fix time or bug bounty has been committed: TBD (owner: Nakul Jain). The repository is private and has one named owner, so acknowledgement depends on that person. The owner records an accepted report as a restricted incident ([incident process](docs/governance/INCIDENT-PROCESS.md)) and fixes it through the normal branch and draft-PR flow ([CONTRIBUTING](CONTRIBUTING.md)).

## Related documents

[Threat model](docs/governance/THREAT-MODEL.md) · [Access-control model](docs/governance/ACCESS-CONTROL-MODEL.md) · [Secrets register](docs/governance/SECRETS-REGISTER.md) · [Secure-development evidence](docs/governance/SECURE-DEVELOPMENT-EVIDENCE.md) · [Security, privacy and clinical safety](docs/current/06_Security-Privacy-and-Clinical-Safety_v1.1.md)

Never commit secrets. If you find one in the repository or its history, report it the same way; the owner rotates it ([secrets register](docs/governance/SECRETS-REGISTER.md)).
