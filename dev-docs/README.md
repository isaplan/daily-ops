# Development Documentation

This directory contains all development-related documentation, scripts, and resources.

## Structure

```
dev-docs/
├── README.md                    # This file
├── scripts/                      # Development and utility scripts
│   ├── dev-start.sh             # Development server startup script
│   ├── generate-registry.ts     # Function registry generator
│   ├── migrate-to-associations.ts # Database migration script
│   ├── seed-dummy-data.js       # Seed script (JS version)
│   ├── seed-dummy-data.ts       # Seed script (TS version)
│   └── validate-metadata.ts     # Metadata validation script
├── cursor-old/                   # Old Cursor IDE configuration files
└── *.md                          # Development documentation files
```

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

## Scripts

All development scripts are located in the `scripts/` subdirectory. See `package.json` for npm scripts that use these files.

## Notes

- All development documentation should be placed in this directory
- Scripts should be placed in `dev-docs/scripts/`
- Keep the root directory clean of development-only files
