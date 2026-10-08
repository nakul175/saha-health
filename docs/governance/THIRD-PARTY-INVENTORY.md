# Third-party inventory and SBOM

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: any change to `package.json` or `pnpm-lock.yaml`, or a new non-npm dependency. Regenerate the SBOM in the same PR.

## SBOM

- File: [sbom.cdx.json](sbom.cdx.json), CycloneDX 1.5, **226 production components** (name, version, package URL; no hashes or licences inside the file).
- Generated 2026-10-08 (file timestamp 2026-10-07T21:56Z) by the repository's own supply-chain gate: `node scripts/security-gate.mjs --sbom ... --report ...`, which lists `pnpm list --prod --depth Infinity`. `npx @cyclonedx/cyclonedx-npm` was not used because the gate already writes CycloneDX and CI uses it.
- Limit: produced from the dependency tree installed in the working copy, not independently diffed against `pnpm-lock.yaml`. Development and build tooling is not in the SBOM; direct dev dependencies are listed below.
- CI regenerates a production SBOM on every build into `dist/sbom.cdx.json` (not committed, not published).

## Vulnerability gate (same run, 2026-10-08)

`pnpm audit` reported 0 critical, 29 high, 19 moderate, 7 low, 0 info. The gate **passed with 0 blocking findings**; 48 high/moderate findings are accepted, 42 as development or build tooling only and 6 as build-time packages not present in `dist/` (the gate's text search of the built output). Accepted high-severity modules include `vite`, `undici`, `ws`, `sharp`, `js-yaml`, `browserslist`, `image-size`, `braces`, `brace-expansion`, `source-map-js`, `react-server-dom-webpack`. These acceptances are the gate's automatic rule, not a person's risk decision: owner review TBD (owner: Nakul Jain). Detail: `dist/security-gate.json` after a gate run.

## Direct production dependencies (resolved versions)

| Package | Version | Licence (pnpm) |
| --- | --- | --- |
| `@base-ui/react` | 1.7.0 | MIT |
| `@hookform/resolvers` | 5.7.1 | MIT |
| `@shadcn/react` | 0.3.0 | MIT |
| `class-variance-authority` | 0.7.1 | Apache-2.0 |
| `clsx` | 2.1.1 | MIT |
| `cmdk` | 1.1.1 | MIT |
| `date-fns` | 4.4.0 | MIT |
| `drizzle-orm` | 0.45.2 | Apache-2.0 |
| `embla-carousel-react` | 8.6.0 | MIT |
| `input-otp` | 1.4.2 | MIT |
| `lucide-react` | 1.31.0 | ISC |
| `next` | 16.3.6 | MIT |
| `next-themes` | 0.4.6 | MIT |
| `radix-ui` | 1.6.7 | MIT |
| `react` | 19.2.6 | MIT |
| `react-day-picker` | 10.0.1 | MIT |
| `react-dom` | 19.2.6 | MIT |
| `react-hook-form` | 7.85.0 | MIT |
| `react-resizable-panels` | 4.12.2 | MIT |
| `recharts` | 3.8.0 | MIT |
| `sonner` | 2.0.8 | MIT |
| `tailwind-merge` | 3.6.0 | MIT |
| `vaul` | 1.1.2 | MIT |
| `zod` | 3.25.76 | MIT |

## Direct development dependencies (resolved versions)

| Package | Version | Licence (pnpm) |
| --- | --- | --- |
| `@axe-core/playwright` | 4.13.0 | (dev only; not in production list) |
| `@cloudflare/vite-plugin` | 1.37.1 | (dev only; not in production list) |
| `@cloudflare/workers-types` | 4.20260515.1 | MIT OR Apache-2.0 |
| `@playwright/test` | 1.56.1 | Apache-2.0 |
| `@tailwindcss/postcss` | 4.2.1 | (dev only; not in production list) |
| `@types/node` | 22.19.19 | MIT |
| `@types/react` | 19.2.14 | MIT |
| `@types/react-dom` | 19.2.3 | MIT |
| `@vitejs/plugin-react` | 6.0.2 | (dev only; not in production list) |
| `@vitejs/plugin-rsc` | 0.5.26 | (dev only; not in production list) |
| `drizzle-kit` | 0.31.10 | (dev only; not in production list) |
| `eslint` | 9.39.4 | (dev only; not in production list) |
| `eslint-config-next` | 16.3.6 | (dev only; not in production list) |
| `playwright-core` | 1.56.1 | Apache-2.0 |
| `react-server-dom-webpack` | 19.2.6 | (dev only; not in production list) |
| `tailwindcss` | 4.2.1 | (dev only; not in production list) |
| `tw-animate-css` | 1.4.0 | (dev only; not in production list) |
| `typescript` | 5.9.3 | (dev only; not in production list) |
| `vinext` | 1.0.0-beta.5 | (dev only; not in production list) |
| `vite` | 8.0.13 | (dev only; not in production list) |
| `wrangler` | 4.92.0 | (dev only; not in production list) |

Licence notes from `pnpm licenses list --prod` (2026-10-08, 208 production packages with a recorded licence): MIT 173, ISC 17, Apache-2.0 10, BSD-3-Clause 3, MIT OR Apache-2.0 1, MIT AND ISC 1, 0BSD 1, CC-BY-4.0 1 (`caniuse-lite`, data), **LGPL-3.0-or-later 1** (`@img/sharp-libvips-linux-x64`, a platform binary of `sharp`; check obligations before any distribution: TBD (owner: Nakul Jain)). This is a tool listing, not a legal licence review.

## Non-npm components and services

| Component | Use | Version evidence |
| --- | --- | --- |
| wrangler runtime on the droplet | Runs the built Worker (`wrangler dev --local`) | 4.148.0 installed outside the repo; repo pins 4.92.0 ([deploy/README.md](../../deploy/README.md)) |
| Caddy, Ubuntu 24.04, systemd, Node, pnpm 11.25.0 | Gateway, OS, runtime, package manager | Per `deploy/provision.sh` and `package.json` |
| DigitalOcean droplet; Cloudflare Workers/D1/Access; GitHub and Actions | Hosting, frozen hosting, source and CI | Accounts held by the owner |
| Playwright 1.56.1 with Chromium; @axe-core/playwright 4.13.0 | Browser and accessibility tests | `package.json` |
| OpenAI Responses API (`gpt-4.1-mini-2025-04-14`) | Optional, off by default | [AI model card](AI-MODEL-CARD.md) |
