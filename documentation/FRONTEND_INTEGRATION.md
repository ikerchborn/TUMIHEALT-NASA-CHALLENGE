# Frontend Integration Contracts

Import all services and types from `@/services` and `@/types`.

## Core Service Functions
- **Profiles:** `createLocalProfile(input)`, `listLocalProfiles()`, `getLocalProfileData(astronautId)`, `updateLocalProfile(astronautId, updates)`, `deleteLocalProfileData(astronautId)`
- **Measurement persistence services (not exposed as manual-entry UI):** `saveBloodMeasurement(input)`, `saveSleepMeasurement(input)`, `saveCardiovascularMeasurement(input)`
- **Personal file import:** CSV, XML, and Excel (.xlsx; legacy .xls is also accepted) files up to 5 MiB. XML is parsed by `parseMeasurementXml`; Excel is extracted by `extractSheetsFromFile(file, { strictPersonalImport: true })`. All normalized files use `inspectCsvFile(csvText, fileName)` → `prepareCsvImportPreview(params)` → explicit `confirmCsvImport(preview)` / `cancelCsvImport(preview)`. `generateImportTemplate(category, format)` creates CSV/XML/XLSX templates.
- **Queries & Mutations:** `getRecords(filter)`, `updateRecord(id, category, updates)`, `deleteRecord(id, category)`
- **Analytics & Baselines:** `getHistoricalTrends(params)`, `getCategoryAnalytics(params)`, `getDataQualitySummary(filter)`, `computePersonalBaseline(options)`
- **Personal check-ins and trends:** `listDailyCheckIns(profileId)`, `queryRecords({ astronaut_id })`, and `getMissionContexts(astronautId)` provide profile-scoped inputs for trend charts and the mission timeline. Research records and aggregates remain separate.
- **Insights, Hazards & Assessment:** `generateExplainableInsights(options)`, `listAllHazards()`, `getHazardsForIndicator(indicatorId)`, `runSelfAssessment(options)`, `listGuidanceCatalog(category?)`
- **Health Assistant:** `getHealthAssistantAnswers(profileId)` returns four deterministic, profile-scoped responses with record/check-in dates, insufficient-data messages, engine-supported next steps, and educational hazard context where relevant. It does not call an LLM or network service.
- **Medical review:** `saveMedicalReviewRequest(input)` and `listMedicalReviewRequests(profileId)` store local Draft/Pending (local)/Exported requests. The drawer can download a JSON summary; it does not transmit the request and disables export in demo mode.
- **Body Explorer:** `/body` uses an interactive 2D SVG and keyboard-accessible region list. A licensed `.glb` is not present, so no 3D model is rendered.
- **Health Guides:** `/guides` presents Blood, Sleep, and Cardiovascular explanations with plain-language summaries first and advanced details collapsed. Space Health Risks is the second tab and covers the five RIDGE hazards; `/hazards` redirects to that tab.
- **NASA Research:** research observations and cohort aggregates are labeled by origin and are not used in personal trends or baselines. Research file import is disabled in Demo Mode.
- **Mission & Privacy:** IndexedDB is not encrypted at rest and profile selection is not authentication. Backup, restore, personal import, and export actions are disabled in Demo Mode.
- **Indicators & Mission Context:** `getIndicatorMetadata(id)`, `listIndicatorsByCategory(category?)`, `saveMissionContext(input)`, `getMissionContexts(astronautId)`
- **Audit & Security:** `getProfileAuditHistory(profileId)`, `getRecordAuditHistory(recordId)`, `exportLocalBackup(astronautId?)`, `restoreLocalBackup(payload, options)`, `exportRecordsToSafeCsv(records)`
- **NASA Research & Aggregates (Separated from Personal Records):**
  - ETLs: `processCmpDataset(csvText)`, `processCbcDataset(csvText)`, `processApolloDataset(csvText)`, `processActigraphyDataset(csvTexts)`
  - Persistence & Queries: `saveResearchDatasetRecords(records)`, `queryResearchDatasetRecords(filter?)`, `saveResearchAggregates(aggregates)`, `queryResearchAggregates(filter?)`

## Example Synthetic Request & Response
```ts
const saved = await saveCardiovascularMeasurement({
  astronaut_id: 'astro-demo-01',
  timestamp: '2026-11-14T08:00:00Z',
  indicator: 'heart_rate',
  value: 64,
  unit: 'bpm',
  data_origin: 'SYNTHETIC',
  activity_context: 'resting',
  sleep_state: 'awake',
});
```

The measurement persistence functions remain available for service and demo seeding use. Personal health measurements are entered through the application UI by importing a file, not by using a single-record form.
