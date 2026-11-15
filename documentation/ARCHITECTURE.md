# TUMI-HEALT System Architecture

## Overview
TUMI-HEALT is a **local-first** web platform built with React, TypeScript, Vite, and **IndexedDB (Dexie.js v5)** for astronaut health monitoring (NASA Space Apps Challenge 2026). All personal health records remain in the user's browser; there is no centralized backend database.

## Layered Module Structure (`src/`)
- **`src/types/`**: Domain models including daily check-ins (`checkIn.ts`) and mission context (`scientific.ts`).
- **`src/services/storage/`**: Dexie.js database (`tumi_healt_local_db`, v5) with profile, health-record, import, audit, mission-context, research, and daily-check-in stores. Version 5 adds `daily_checkins` without modifying prior migrations.
- **`src/services/validation/`**: Technical, timestamp, provenance, and unit-compatibility validation (`recordValidator.ts`, `unitRegistry.ts`).
- **`src/services/ingestion/`**: RFC-4180 CSV parser and 9-step confirmation-gated CSV importer (`csvParser.ts`, `csvImportService.ts`).
- **`src/services/dataEngineering/`**: NASA processed dataset row mapper (`scientificImportMapper.ts`).
- **`src/services/indicators/`**: Scientific Indicator Knowledge Catalog (`indicatorCatalog.ts`).
- **`src/services/baseline/`**: Personal Health Baseline Engine (`baselineEngine.ts`).
- **`src/services/insights/`**: Explainable Health Insights Engine (`insightsEngine.ts`).
- **`src/services/hazards/`**: Spaceflight Hazard Knowledge Engine (`hazardEngine.ts`).
- **`src/services/assessment/`**: Deterministic Self-Assessment & Guidance Engine (`selfAssessmentEngine.ts`).
- **`src/services/missionContext/`**: Mission Context Engine (`missionContextService.ts`).
- **`src/services/checkIn/`**: Profile-scoped daily self-report storage and same-day editing (`dailyCheckInService.ts`).
- **`src/services/security/`**: Backup/restore with SHA-256 integrity, CSV formula-injection protection, and upload constraints (`securityService.ts`).
- **`src/services/audit/`**: Local operation audit trail (`auditService.ts`).
- **`src/services/healthService.ts`**: Unified frontend integration facade.
