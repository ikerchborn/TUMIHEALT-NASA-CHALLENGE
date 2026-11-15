# TUMI-HEALT — 90-Day Synthetic Astronaut Health Dataset

> **IMPORTANT SCIENTIFIC PROVENANCE NOTICE**
>
> All files in this directory (`data/synthetic/`) contain **SYNTHETIC DATA** (`data_origin: SYNTHETIC`).
> - These records do **not** represent the actual medical history of any real astronaut or human research participant.
> - No identifiable participant records were copied from NASA research repositories.
> - Generated values are **not** official NASA clinical measurements and must **not** be used as clinical reference ranges or diagnostic thresholds.

---

## 1. Purpose

The 90-day synthetic dataset allows an astronaut, flight surgeon, or evaluator to immediately explore **TUMI-HEALT**—either via the one-click **"Explore with a demo astronaut"** onboarding mode (`demo-astronaut`) or by importing the CSV files directly through `/import`—without needing to prepare external laboratory or wearable files first.

The timeline spans **90 consecutive mission days** (`DEMO-EXP-90D`) and is structured to demonstrate:
1. **Initial personal baseline establishment** (Days 1–30 / `daysAgo: 89..60`).
2. **Mid-mission physiological stability** (Days 31–65 / `daysAgo: 59..25`).
3. **Late-mission operational workload changes** (Days 66–90 / `daysAgo: 24..1`) that trigger statistical review observations (`>= 20%` shift in `sleep_duration`, `sleep_latency`, and `physical_activity`).
4. **Explicit missing values (`NA` / `null`)** with `quality_status = missing_value` (never replaced with `0`).
5. **Outdated measurements (`> 14 days` old)** (`cardiac_output` last recorded on Day -19) to demonstrate data-freshness warnings (`MONITOR`).
6. **Insufficient sample counts (`< 3` valid records)** (`mpv` recorded on only 2 blood draws) to demonstrate the personal baseline engine's `INSUFFICIENT_DATA` safeguard.
7. **Distinctions across measurement frequencies and information types**:
   - Frequent instrument & wearable time-series (every 2 days across 90 days = 45 collection days).
   - Episodic venous laboratory draws (6 scheduled collection dates across 90 days — **not** daily blood draws).

---

## 2. NASA Research Sources & Structural Grounding

| Category | NASA Research Source Inspected | How It Informed This Synthetic Dataset | Limitations & Assumptions |
| --- | --- | --- | --- |
| **Blood — Complete Blood Count (CBC)** | **NASA OSDR OSD-569** (`LSDS-7 CBC`) | Informed variable identifiers (`hemoglobin`, `hematocrit`, `red_blood_cell_count`, `white_blood_cell_count`, `platelet_count`, `mcv`, `mch`, `mchc`, `rdw`, `mpv`), units (`g/dL`, `%`, `10^6/uL`, `10^3/uL`, `fL`, `pg`), specimen metadata (`whole_blood`), and episodic sampling structure. | OSD-569 uses relative mission timepoints (e.g., `L-3`, `R+1`) and flags hemoglobin unit `%` for verification. Synthetic records use standard `g/dL` for hemoglobin and ISO-8601 timestamps across a 90-day mission window. |
| **Blood — Comprehensive Metabolic Panel (CMP)** | **NASA OSDR OSD-575** (`LSDS-8 CMP`, Beckman Coulter AU5800) | Informed variable identifiers (`glucose`, `creatinine`, `urea_nitrogen_bun`, `sodium`, `potassium`, `chloride`, `carbon_dioxide`, `calcium`, `albumin`, `total_protein`, `alt`, `ast`, `alkaline_phosphatase`, `total_bilirubin`), units (`mg/dL`, `mmol/L`, `g/dL`, `U/L`), and `serum` specimen metadata. | OSD-575 contains preflight and postflight timepoints. Synthetic inflight collection dates (`SYN-LAB-D03` through `SYN-LAB-D87`) are illustrative scheduled mission blood draws. |
| **Sleep & Circadian Actigraphy** | **NASA NLSP UTMB Bedrest Campaign 1** (`BRSMACT`) | Informed variable identifiers (`sleep_duration`, `sleep_efficiency`, `sleep_latency`), units (`hours`, `%`), and multi-week longitudinal actigraphy variability. | UTMB Campaign 1 is a `GROUND_ANALOG` head-down-tilt bedrest study and lacks `sleep_start`/`sleep_end` timestamps. Synthetic records include illustrative `sleep_start` and `sleep_end` ISO timestamps. |
| **Cardiovascular & Vital Signs** | **NASA NLSP Apollo AP005** & NASA HRP Countermeasure Protocols | Informed core hemodynamic indicators (`heart_rate` in `bpm`, `systolic_blood_pressure` and `diastolic_blood_pressure` in `mmHg`, `cardiac_output` in `L/min`). Additional crew vitals (`body_temperature` in `°C`, `respiratory_rate` in `breaths/min`, `blood_oxygen_saturation` in `%`, `physical_activity` in `minutes`) are included to support vital-sign and countermeasure tracking. | Apollo AP005 provides cohort-level group summaries (`aggregated_not_individual`). Individual time-series trajectories and additional vital signs (`body_temperature`, `respiratory_rate`, `blood_oxygen_saturation`, `physical_activity`) are **illustrative synthetic assumptions**. |

---

## 3. Generated Files

1. **`tumi_synthetic_90d_cardiovascular.csv`** (`320` rows)
   - **Frequency:** Every 2 days across 90 days (45 timepoints) for wearable/instrument vitals; 5 periodic ultrasound/rebreathing measurements for `cardiac_output` (`daysAgo: 83, 67, 51, 35, 19`).
   - **Variables & Units:**
     - `heart_rate` (`bpm`) — Instrument measurement (includes 1 explicit `NA` missing value at `daysAgo: 45`)
     - `systolic_blood_pressure` (`mmHg`) — Instrument measurement
     - `diastolic_blood_pressure` (`mmHg`) — Instrument measurement
     - `body_temperature` (`°C`) — Instrument measurement (illustrative assumption)
     - `respiratory_rate` (`breaths/min`) — Instrument measurement (illustrative assumption)
     - `blood_oxygen_saturation` (`%`) — Instrument measurement (illustrative assumption)
     - `physical_activity` (`minutes`) — Wearable/countermeasure log (illustrative assumption; shows `-25%` reduction during late-mission high workload)
     - `cardiac_output` (`L/min`) — Instrument measurement (last recorded 19 days ago to demonstrate `> 14 days` outdated data notification)

2. **`tumi_synthetic_90d_sleep.csv`** (`135` rows)
   - **Frequency:** Every 2 days across 90 days (45 timepoints).
   - **Variables & Units:**
     - `sleep_duration` (`hours`) — Wearable actigraphy estimate (shows `>= 20%` decrease in final 24 days to trigger `REVIEW_REQUIRED`; includes 2 explicit `NA` missing values at `daysAgo: 49` and `11`)
     - `sleep_efficiency` (`%`) — Wearable actigraphy estimate
     - `sleep_latency` (`hours`) — Wearable actigraphy estimate

3. **`tumi_synthetic_90d_blood.csv`** (`140` rows)
   - **Frequency:** **Episodic** — 6 scheduled laboratory draws across 90 days (`SYN-LAB-D03`, `SYN-LAB-D19`, `SYN-LAB-D37`, `SYN-LAB-D55`, `SYN-LAB-D73`, `SYN-LAB-D87` corresponding to `daysAgo: 87, 71, 53, 35, 17, 3`).
   - **Variables & Units (24 biomarkers):**
     - **CBC (`whole_blood`):** `hemoglobin` (`g/dL`), `hematocrit` (`%`), `red_blood_cell_count` (`10^6/uL`), `white_blood_cell_count` (`10^3/uL`), `platelet_count` (`10^3/uL`), `mcv` (`fL`), `mch` (`pg`), `mchc` (`g/dL`), `rdw` (`%`), `mpv` (`fL` — only 2 samples to demonstrate `< 3` `INSUFFICIENT_DATA`).
     - **CMP (`serum`):** `glucose` (`mg/dL` — includes 1 explicit `NA` missing value on `SYN-LAB-D55`), `creatinine` (`mg/dL`), `urea_nitrogen_bun` (`mg/dL`), `sodium` (`mmol/L`), `potassium` (`mmol/L`), `chloride` (`mmol/L`), `carbon_dioxide` (`mmol/L`), `calcium` (`mg/dL`), `albumin` (`g/dL`), `total_protein` (`g/dL`), `alt` (`U/L`), `ast` (`U/L`), `alkaline_phosphatase` (`U/L`), `total_bilirubin` (`mg/dL`).

---

## 4. How to Import or Explore

- **One-Click Demo Mode:** Click **"Explore with a demo astronaut"** on `/welcome` or in the top header. TUMI-HEALT creates the isolated `demo-astronaut` profile (`Cmdr. Alex Rivera (Demo)`) and loads all 595 synthetic records + daily check-ins automatically without touching any personal profile.
- **Direct CSV Import:** Open **My Health Data (`/import`)**, select a personal profile, and either click the built-in **Download 90-Day Synthetic CSV** buttons or upload any of the three CSV files from `data/synthetic/`.
