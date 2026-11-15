# Frontend Integration Contracts

Import all services and types from `@/services` and `@/types`.

## Core Service Functions
- **Profiles:** `createLocalProfile(input)`, `listLocalProfiles()`, `getLocalProfileData(astronautId)`, `updateLocalProfile(astronautId, updates)`, `deleteLocalProfileData(astronautId)`
- **Manual Entry:** `saveBloodMeasurement(input)`, `saveSleepMeasurement(input)`, `saveCardiovascularMeasurement(input)`
- **CSV Import:** `inspectCsvFile(csvText, fileName)` → `prepareCsvImportPreview(params)` → `confirmCsvImport(preview)` / `cancelCsvImport(preview)`
- **Queries & Mutations:** `getRecords(filter)`, `updateRecord(id, category, updates)`, `deleteRecord(id, category)`
- **Analytics & Baselines:** `getHistoricalTrends(params)`, `getCategoryAnalytics(params)`, `getDataQualitySummary(filter)`, `computePersonalBaseline(options)`
- **Insights, Hazards & Assessment:** `generateExplainableInsights(options)`, `listAllHazards()`, `getHazardsForIndicator(indicatorId)`, `runSelfAssessment(options)`, `listGuidanceCatalog(category?)`
- **Indicators & Mission Context:** `getIndicatorMetadata(id)`, `listIndicatorsByCategory(category?)`, `saveMissionContext(input)`, `getMissionContexts(astronautId)`
- **Audit & Security:** `getProfileAuditHistory(profileId)`, `getRecordAuditHistory(recordId)`, `exportLocalBackup(astronautId?)`, `restoreLocalBackup(payload, options)`, `exportRecordsToSafeCsv(records)`

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
