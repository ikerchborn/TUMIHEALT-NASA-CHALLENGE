# Astronaut Health Monitoring System — TUMI-HEALT

## Project Overview
TUMI-HEALT lets astronauts import and review personal health records across blood biomarkers, sleep, and cardiovascular health. Personal records are stored locally in the browser using IndexedDB. Health measurements enter through file import; the application UI does not provide manual measurement entry.

## NASA Space Apps Challenge 2026
TUMI-HEALT is developed as part of the **2026 NASA Space Apps Challenge**, responding to the official challenge **“Create Health Monitoring Software for Astronauts on Space Missions.”** (see https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

Long‑duration space missions expose astronauts to several hazards, including:
- Space radiation
- Isolation and confinement
- Distance from Earth
- Altered gravity fields
- Hostile closed environments

These conditions can lead to health risks such as immune system changes, bone loss, cardiovascular events, inadequate nutrition, and behavioral health problems. Astronauts need tools to identify health changes and perform self‑assessments when immediate medical support is unavailable.

## How TUMI-HEALT Addresses the Challenge
The platform supports astronaut self‑assessment through three monitoring categories:

**Blood Biomarkers**
- Organise and review blood‑related measurements.
- Provide contextual information about available biomarkers.
- Support interpretation of changes over time.

**Sleep Monitoring**
- Track sleep duration, latency, and efficiency.
- Help astronauts understand sleep patterns and potential deviations.

**Cardiovascular Monitoring**
- Track heart rate and blood pressure.
- Include cardiac output when suitable measurements are available.
- Consider activity context and sleep state when interpreting cardiovascular data.

By transforming imported health measurements into clear visualisations, TUMI-HEALT helps astronauts review their own data and identify changes that may warrant attention. It does not provide a clinical diagnosis.

## Project Objectives
- Monitor blood biomarkers.
- Track sleep patterns.
- Monitor cardiovascular parameters.
- Visualise health trends over time.
- Provide health‑data interpretation tools **without** claiming clinical diagnosis.

## Key Features
- **Implemented**: First-use welcome, local profiles, and an isolated synthetic demo profile.
- **Implemented**: CSV, XML, and Excel (.xlsx; legacy .xls is also accepted) personal imports, generated templates, row-level validation, duplicate detection, downloadable rejection reports, and explicit confirmation before partial imports.
- **Implemented**: Blood, sleep, and cardiovascular history views with charts, personal baselines, and indicator education.
- **Implemented**: My Measurements Import/History tabs and a personal Trends workspace with 7D/14D/30D/90D/MAX ranges, four charts, symptom check-in markers, and a mission timeline.
- **Implemented**: Daily Check-in for self-reported mood, energy, symptoms, and notes. Entries are stored separately from measurements, are editable once per profile and date, and are labeled as self-reported or synthetic demo data.
- **Implemented**: Mission Home shows the active profile, mission day when a start date is configured, today’s check-in, four health summaries, recent activity, and engine-derived observations.
- **Implemented**: Body Explorer provides an interactive, keyboard-accessible 2D SVG with head/sleep, chest/cardiovascular, torso/blood, and educational bones/muscles regions. No licensed `.glb` asset is present, so the app does not load a 3D model.
- **Implemented**: Health Assistant answers four questions with deterministic local rules, dates for supporting records, missing-data prompts, personal-baseline comparisons, and explicit non-diagnostic language. It makes no LLM or network calls.
- **Implemented**: Medical review drawer selects local measurements and check-ins, stores Draft/Pending (local)/Exported requests on-device, and downloads a JSON summary. It never simulates sending or receiving a response; exports are disabled in demo mode.
- **Implemented**: Health Guides explains indicators simply before advanced details; the Space Health Risks tab presents the five RIDGE hazards.
- **Implemented**: NASA research ETL and storage stay separate from personal records and are labeled as scientific research, not personal health records.
- **Implemented**: Mission & Privacy explains local storage and profile selection accurately; import, backup, restore, and export actions are disabled in demo mode.
- **Implemented**: Local persistence with IndexedDB via Dexie.js, audit history, and backup/restore.
- **Not supported yet**: Measurement entry from devices, a licensed 3D anatomical model, or any connection to a medical team.

## System Architecture
- **Frontend**: React + TypeScript + Vite.
- **Local Persistence**: IndexedDB (Dexie.js abstraction).
- **Validation & Analytics**: Service layer under `src/services`.
- **Research Datasets**: Public NASA datasets used for development, reference, and validation only.
- **No Centralised Database** for personal astronaut records.

## Technology Stack
- React
- TypeScript
- Vite
- IndexedDB (Dexie.js)
- Recharts (health trend visualisation)
- Git & GitHub

*All technologies are proposed; concrete implementation may evolve.*

## Scientific Foundation and Research Data
NASA and other research datasets are used to understand how spaceflight and ground‑based analog environments affect human health.

**Datasets**
- **OSD‑569** – Complete Blood Count (CBC) – https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- **OSD‑575** – Comprehensive Metabolic Panel (CMP) – https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
- **UTMB Bed‑rest Campaign 1** – Sleep‑related variables – https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS
- **STS‑55 (AP005)** – Cardiovascular research parameters – https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS

**Data Origin Classification**
- `SPACEFLIGHT`: Data collected during actual spaceflight missions.
- `GROUND_ANALOG`: Data from ground‑based simulations or bed‑rest studies (e.g., UTMB Campaign 1).
- `SYNTHETIC`: Artificially generated data for testing and the clearly labeled demo profile.

Ground‑based analog data are never presented as actual spaceflight measurements.

## Research Data Sources
- **OSD‑569**: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- **OSD‑575**: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
- **UTMB Bed‑rest Campaign 1**: https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS
- **STS‑55 (AP005)**: https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS

> *All dataset files, variables, units, and compatibility must be verified before integration.*

## Expected Contribution
TUMI-HEALT contributes to the NASA Space Apps Challenge by providing astronauts with a structured, visual, and accessible tool to monitor selected health indicators, understand changes in their measurements, and access contextual information that supports informed health decisions during space missions. This aligns directly with the challenge’s objective of helping astronauts assess and act on their own health status.

## Repository Structure
- `documentation/` – design docs, data provenance, architecture, privacy.
- `data/` – raw research data, processed copies, dictionaries, schemas.
- `src/` – application source code.
- `tests/` – unit, integration, and data‑validation tests.
- `.github/` – issue and PR templates.

## Installation and Setup
```bash
# Clone the repository
git clone https://github.com/ikerchborn/TUMIHEALT-NASA-CHALLENGE.git
cd TUMI-HEALT

# Set up Python virtual environment (if needed for data processing scripts)
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt  # currently only development dependencies

# Install frontend dependencies
npm install

# Start the development server
npm run dev
```
*Adjust commands according to the actual project configuration – these are preliminary instructions.*

## Data Management and Privacy
Personal astronaut health records are stored **only** in the browser’s IndexedDB. They are never uploaded to a central server. Research datasets are stored under `data/raw/` for development and remain read‑only.

- Each astronaut manages their own local health records.
- Users can delete their local information at any time.
- IndexedDB does **not** automatically encrypt stored data; any encryption must be handled by the application.
- Local data is not synchronized across devices by default.

## Development Workflow
- Use feature branches (`feature/<name>`).
- Follow conventional commits.
- Open pull requests for review.
- Ensure documentation is updated with each change.

## Testing
- Unit tests under `tests/unit/`.
- Integration tests under `tests/integration/`.
- Data‑validation tests under `tests/data-validation/`.
- Browser QA: `npm run test:e2e`, `npm run qa:a11y`, `npm run qa:screenshots`, and `npm run qa:lighthouse`.

## Scientific Considerations and Limitations
- Research datasets originate from varied subjects and collection periods; ground‑analog data is **not** equivalent to spaceflight data.
- Blood measurements are typically intermittent.
- Statistical deviations do **not** imply medical conditions.
- The platform is **not** a replacement for professional medical advice.

## Project Status
**Frontend and local data services are implemented; check the compliance matrix for current capabilities and known gaps.**

## License and Acknowledgments
License: GPL-3.0 license

Acknowledgments: NASA and the providers of the OSD‑569, OSD‑575, UTMB Bed‑rest, and STS‑55 datasets.
