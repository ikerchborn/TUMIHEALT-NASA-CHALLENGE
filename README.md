# Astronaut Health Monitoring System — TUMI-HEALT

## Project Overview
The TUMI-HEALT platform enables astronauts to record, review, and visualise their personal health data across three core categories: blood biomarkers, sleep monitoring, and cardiovascular monitoring. The system is a web‑based frontend that stores each astronaut’s records locally in the browser using IndexedDB.

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

By transforming raw health measurements into clear visualisations, TUMI-HEALT enables astronauts to evaluate their health status and identify changes that may warrant attention.

## Project Objectives
- Monitor blood biomarkers.
- Track sleep patterns.
- Monitor cardiovascular parameters.
- Visualise health trends over time.
- Provide health‑data interpretation tools **without** claiming clinical diagnosis.

## Key Features
- **Planned**: Data entry UI for blood, sleep, and cardiovascular metrics.
- **Planned**: Interactive dashboards with trend charts.
- **Implemented**: Local persistence using IndexedDB via Dexie.js (foundation present).
- **Planned**: Validation services, analytics, and export functionality.

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
- Recharts (planned for visualisation)
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
- `SYNTHETIC`: Artificially generated data for testing (none currently used).

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

## Scientific Considerations and Limitations
- Research datasets originate from varied subjects and collection periods; ground‑analog data is **not** equivalent to spaceflight data.
- Blood measurements are typically intermittent.
- Statistical deviations do **not** imply medical conditions.
- The platform is **not** a replacement for professional medical advice.

## Project Status
**INITIAL STRUCTURE / DEVELOPMENT IN PROGRESS**

## License and Acknowledgments
License: *Pending* – to be added.

Acknowledgments: NASA and the providers of the OSD‑569, OSD‑575, UTMB Bed‑rest, and STS‑55 datasets.
