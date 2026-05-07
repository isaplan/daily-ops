# Development Documentation

This directory contains all development-related documentation, scripts, and resources.

## Structure

```
dev-docs/
├── README.md                    # This file
├── scripts/                     # Registry, seeds, metadata (see package.json)
│   ├── dev-start.sh
│   ├── generate-registry.ts
│   ├── migrate-to-associations.ts
│   ├── seed-dummy-data.{js,ts}
│   └── validate-metadata.ts
├── cursor-old/                  # Archived Cursor / agent notes
└── *.md                         # All long-form dev docs (including items moved from repo root)
```

One-off Mongo / cron debug scripts live in the repository **`scripts/`** folder at the project root (next to `package.json`), not under `dev-docs/scripts/`.

## Documentation Files

- **SETUP.md** - Initial project setup instructions
- **QUICKSTART.md** - Quick start guide
- **IMPLEMENTATION_PLAN.md** - Detailed implementation plan
- **IMPLEMENTATION_INDEX.md** - Implementation index/reference
- **MVVM_UPGRADE_PLAN.md** - MVVM architecture upgrade plan
- **TYPESCRIPT_STRICT_ENFORCEMENT.md** - TypeScript strict mode guidelines
- **TODO_MANAGEMENT_GUIDE.md** - Todo management system guide
- **DASHBOARD_ACCESS_GUIDE.md** - Dashboard access control guide
- **PERMISSION_UPDATES.md** - Permission system updates
- **README-POC.md** - Proof of concept documentation
- **CRON_SCHEDULER_SETUP.md** — External cron / scheduler for Bork & Eitje jobs
- **V3-QUICK-START.md**, **V3-AGGREGATION-BUILD-PLAN.md**, **V3-AGGREGATION-IMPLEMENTATION-COMPLETE.md**, **V3-STRUCTURE-REFACTORED.md** — V3 aggregation notes
- **AGGREGATION-LOGIC-VERIFICATION.md**, **DASHBOARD-STRUCTURE-COMPLETE.md**, **STRUCTURE-ISOLATION-COMPLETE.md**, **FINAL-ISOLATION-COMPLETE.md**, **V2-V3-PAGES-SETUP.md** — Structure / verification write-ups
- **DEBUG_BUSINESS_HOUR_MAPPING.md** — Hour mapping & Bork CSV vs API investigations (updated by some `scripts/*.ts` tools)
- **QUICK_START_WORKERS.md**, **WORKER_IMPORT_SUMMARY.md** — Workers import notes
- **raw_data_example.md** — Sample raw data reference

## Scripts

- **`dev-docs/scripts/`** — registry generator, metadata validation, seed templates (see `package.json` scripts).
- **`scripts/`** (project root) — data checks, backfills, migrations, and ad-hoc `.mjs` / `.ts` utilities.

## Notes

- Place new development documentation in this `dev-docs/` directory (not the repository root).
- Keep the repository root limited to app config, `README.md`, and standard tooling files.
