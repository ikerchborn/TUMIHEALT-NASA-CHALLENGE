# Scientific Dataset Mapping & Provenance Analysis (TUMI-HEALT)

**Phase:** Fase 1 — Scientific Analysis & Mapping  
**Status:** Verified against `data/raw/` and `documentation/DATA_SOURCES.md`

---

## 1. Dataset Inventory & Provenance Verification

| Dataset | Raw Path | Official Provenance | Format & Shape | Data Origin | Target Model |
| --- | --- | --- | --- | --- | --- |
| **OSD-575 (CMP)** | `data/raw/blood/OSD-575/OSD-575-LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` | [NASA OSDR OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) — SpaceX Inspiration4 Serum CMP (Quest Diagnostics / Beckman Coulter AU5800) | CSV, wide format: 28 data rows (4 subjects × 7 timepoints), 58 columns | `SPACEFLIGHT` | `ResearchDatasetRecord` |
| **OSD-569 (CBC)** | `data/raw/blood/OSD-569/OSD-596-LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | [NASA OSDR OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) — SpaceX Inspiration4 Whole-Blood CBC | CSV, wide format: 28 data rows (4 subjects × 7 timepoints), 61 columns | `SPACEFLIGHT` | `ResearchDatasetRecord` |
| **Apollo AP005** | `data/raw/cardiovascular/AP005_1794688852628/*.xls` | [NASA LSDA AP005](https://nlsp.nasa.gov/explore/lsdahome) — Apollo 7–17 Flight Crew Cardiovascular Evaluations | 3 legacy `.xls` workbooks (`Table V`, `Table5`, `Table6a`), multi-row headers, cohort summaries | `SPACEFLIGHT` | `ResearchAggregate` |
| **UTMB Actigraphy (BRSMACT)** | `data/raw/sleep/UTMB_Campaign_1/` | [NASA LSDA](https://nlsp.nasa.gov/explore/lsdahome) — UTMB Bed-Rest Campaign 1 Actigraphy | Extensionless CSVs (`_Actigraphy`, `_Query_Result`, `_ReadMe`) × 3 identical folders | `GROUND_ANALOG` | `ResearchDatasetRecord` / `HealthRecordInput` |

### Critical Identifier Verification: `OSD-596` vs `OSD-569`
- The local CBC file is named `OSD-596-LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv`.
- **Verification result:** In NASA OSDR, official study `OSD-596` is an unrelated *Drosophila* study. The Inspiration4 whole-blood CBC assay is **OSD-569**, which shares the exact same 4 participant IDs (`C001`, `C002`, `C003`, `C004`) and 7 relative timepoints (`L-92`, `L-44`, `L-3`, `R+1`, `R+45`, `R+82`, `R+194`) as `OSD-575`.
- **Decision:** Keep the raw filename unchanged for auditability, but tag normalized records with `source_dataset = "OSD-569"` and preserve the original filename in `source_file`.

### Actigraphy Duplicate Verification
- `data/raw/sleep/UTMB_Campaign_1/` contains three download packages (`BRSMAct_1794688595631`, `BRSMAct_1794688605171`, `BRSMAct_1794688636449`), and the consolidated Excel contains 3 identical copies of each file (`(1)`, `(2)`).
- `BRSMACT_Campagin_1_Actigraphy` contains all 3 subjects (`C1G0001`, `C1G0002`, `C1G0003`, 207 data rows).
- `BRSMACT_Campagin_1_Actigraphy_Query_Result` contains 191 rows for `C1G0002` (`POST_TEST` only) and `C1G0003` with `Record Number`, plus a formatting anomaly on row 87 (`6.56` instead of `6:56`).
- `BRSMACT_Campaign_1_Actigraphy_ReadMe` is metadata/documentation, not measurement rows.
- **Decision:** Process **one canonical copy** of `BRSMACT_Campagin_1_Actigraphy`, deduplicate by `(subject, date, test_phase, br_day, indicator)`, and never treat the 3 copies as independent datasets.

---

## 2. OSD-575 (CMP) Variable Mapping

Sample ID pattern: `{subject_id}_serum_{timepoint}` (e.g. `C001_serum_L-3`).  
Timepoints: `L-92`, `L-44`, `L-3` (`preflight`), `R+1`, `R+45`, `R+82`, `R+194` (`postflight`). **No absolute ISO dates exist.**

| Original Value Column | TUMI-HEALT `indicator` | Original Unit | Normalized Unit | Reference Range Columns | Notes |
| --- | --- | --- | --- | --- | --- |
| `albumin_value_gram_per_deciliter` | `albumin` | `gram_per_deciliter` | `g/dL` | `min`, `max` | Direct match |
| `albumin_to_globulin_ratio_value` | `albumin_to_globulin_ratio` | *(none)* | `ratio` | `min`, `max` | Dimensionless ratio |
| `alkaline_phosphatase_value_units_per_liter` | `alkaline_phosphatase` | `units_per_liter` | `U/L` | `min`, `max` | Enzyme activity |
| `alt_value_units_per_liter` | `alt` | `units_per_liter` | `U/L` | `min`, `max` | Note raw max col is `alt_max_units_per_liter` |
| `ast_value_units_per_liter` | `ast` | `units_per_liter` | `U/L` | `min`, `max` | Note raw max col is `ast_max_units_per_liter` |
| `total_bilirubin_value_milligram_per_deciliter` | `total_bilirubin` | `milligram_per_deciliter` | `mg/dL` | `min`, `max` | Direct match |
| `bun_to_creatinine_ratio_value` | `bun_to_creatinine_ratio` | *(none)* | `ratio` | `min`, `max` | Contains `NA` and blank cells → `null` |
| `calcium_value_milligram_per_deciliter` | `calcium` | `milligram_per_deciliter` | `mg/dL` | `min`, `max` | Direct match |
| `carbon_dioxide_value_millimol_per_liter` | `carbon_dioxide` | `millimol_per_liter` | `mmol/L` | `min`, `max` | Direct match |
| `chloride_value_millimol_per_liter` | `chloride` | `millimol_per_liter` | `mmol/L` | `min`, `max` | Direct match |
| `creatinine_value_milligram_per_deciliter` | `creatinine` | `milligram_per_deciliter` | `mg/dL` | `min`, `max` | Direct match |
| `egfr_african_american_value_milliliter_per_minute_per_1.73_meter_squared` | `egfr_african_american` | `milliliter_per_minute_per_1.73_meter_squared` | `mL/min/1.73m^2` | `min`, `max` (`N/A` → `null`) | Race-stratified CKD-EPI/MDRD formula output; upper range `N/A` |
| `egfr_non_african_american_value_milliliter_per_minute_per_1.73_meter_squared` | `egfr_non_african_american` | `milliliter_per_minute_per_1.73_meter_squared` | `mL/min/1.73m^2` | `min`, `max` (`N/A` → `null`) | Race-stratified formula output; upper range `N/A` |
| `globulin_value_gram_per_deciliter` | `globulin` | `gram_per_deciliter` | `g/dL` | `min`, `max` | Direct match |
| `glucose_value_milligram_per_deciliter` | `glucose` | `milligram_per_deciliter` | `mg/dL` | `min`, `max` | Fasting status not guaranteed |
| `potassium_value_millimol_per_liter` | `potassium` | `millimol_per_liter` | `mmol/L` | `min`, `max` | Direct match |
| `total_protein_value_gram_per_deciliter` | `total_protein` | `gram_per_deciliter` | `g/dL` | `min`, `max` | Direct match |
| `sodium_value_millimol_per_liter` | `sodium` | `millimol_per_liter` | `mmol/L` | `min`, `max` | Direct match |
| `urea_nitrogen_bun_value_milligram_per_deciliter` | `urea_nitrogen_bun` | `milligram_per_deciliter` | `mg/dL` | `min`, `max` | Direct match |

---

## 3. OSD-569 (CBC) Variable Mapping

Sample ID pattern: `{subject_id}_whole-blood_{timepoint}_cbc` (e.g. `C001_whole-blood_L-3_cbc`).  
Timepoints: same 7 relative timepoints (`L-92` to `R+194`). **No absolute ISO dates exist.**

| Original Value Column | TUMI-HEALT `indicator` | Original Unit | Normalized Unit | Special Verification / Notes |
| --- | --- | --- | --- | --- |
| `absolute_basophils_value_cells_per_microliter` | `absolute_basophils` | `cells_per_microliter` | `cells/uL` | Direct match |
| `absolute_eosinophils_value_cells_per_microliter` | `absolute_eosinophils` | `cells_per_microliter` | `cells/uL` | Direct match |
| `absolute_lymphocytes_value_cells_per_microliter` | `absolute_lymphocytes` | `cells_per_microliter` | `cells/uL` | Direct match |
| `absolute_monocytes_value_cells_per_microliter` | `absolute_monocytes` | `cells_per_microliter` | `cells/uL` | Direct match |
| `absolute_neutrophils_value_cells_per_microliter` | `absolute_neutrophils` | `cells_per_microliter` | `cells/uL` | Direct match |
| `basophils_value_percent` | `basophils_percent` | `percent` | `%` | Percentage of WBC |
| `eosinophils_value_percent` | `eosinophils_percent` | `percent` | `%` | Percentage of WBC |
| `hematocrit_value_percent` | `hematocrit` | `percent` | `%` | Direct match |
| `hemoglobin_value_percent` | `hemoglobin` | `percent` | `%` *(flagged)* | **AMBIGUOUS:** Source labels hemoglobin as `%` (`unit_label_requires_verification`). Values (11.5–17.0) look like `g/dL`, but **never silently convert** `%` → `g/dL`. |
| `lymphocytes_value_percent` | `lymphocytes_percent` | `percent` | `%` | Percentage of WBC |
| `mch_value_picogram` | `mch` | `picogram` | `pg` | Direct match |
| `mchc_value_grams_per_deciliter` | `mchc` | `grams_per_deciliter` | `g/dL` | Direct match |
| `mcv_value_femtoliter` | `mcv` | `femtoliter` | `fL` | Direct match |
| `monocytes_value_percent` | `monocytes_percent` | `percent` | `%` | Percentage of WBC |
| `mpv_value_femtoliter` | `mpv` | `femtoliter` | `fL` | Direct match |
| `neutrophils_value_percent` | `neutrophils_percent` | `percent` | `%` | Percentage of WBC |
| `platelet_count_value_thousand_per_microliter` | `platelet_count` | `thousand_per_microliter` | `10^3/uL` | Direct match |
| `rdw_value_percent` | `rdw` | `percent` | `%` | Direct match |
| `red_blood_cell_count_value_million_per_microliter` | `red_blood_cell_count` | `million_per_microliter` | `10^6/uL` | Direct match |
| `white_blood_cell_count_value_thousand_per_microliter` | `white_blood_cell_count` | `thousand_per_microliter` | `10^3/uL` | Direct match |

---

## 4. Apollo AP005 Classification (Cohort Aggregates)

All three Apollo AP005 files contain **cohort-level aggregated statistics** (`N`, `Mean`, `SDi`, `SDt`, `p-value`, `% change from reference`) and **zero individual astronaut rows**:

- `AP005__2321234337.xls` (`Table V`): Apollo 15–17 Vectorcardiographic Data (Mean of 9 crewmembers) — `heart_rate`, `pr_interval`, `qrs_duration`, `qt_interval`, `p_max_magnitude`, `qrs_max_magnitude`, `st_max_magnitude`, `j_offset_magnitude`, `st_slope`, `qrs_t_spatial_angle`.
- `AP005__2321246468.xls` (`Table5`): Apollo 7–17 Crewmember vs Control Heart Rate (`Resting supine`, `-50mm Hg LBNP`, `Stand`).
- `AP005__2711130718.xls` (`Table6a`): Apollo 7–17 Preflight Summary & Postflight Orthostatic Evaluations (`heart_rate`, `systolic_blood_pressure`, `diastolic_blood_pressure` across `Control`, `-30/-40/-50 mm Hg LBNP`, `Recovery`, `Stand`).

**Decision:** Classify 100% of Apollo AP005 rows as `ResearchAggregate` (`quality_status = "aggregated_not_individual"`). They are stored as scientific evidence and **never** enter `PersonalHealthRecord` or personal baselines.

---

## 5. UTMB Campaign 1 Actigraphy (BRSMACT) Mapping

- **Subjects:** `C1G0001`, `C1G0002`, `C1G0003` (bed-rest ground analog).
- **Dates:** `M/D/YYYY` (`9/7/2004` to `11/14/2004`) → converted to ISO `YYYY-MM-DD`.
- **Phases:** `PRE_TEST`, `IN_TEST`, `POST_TEST` with `BR_Day`.
- **Variables:**
  - `Sleep Latency (hours)` (`HH:mm` or `0`) → `sleep_latency` (`hours`, decimal)
  - `Sleep Duration (hours)` (`H:mm:ss` or `HH:mm`) → `sleep_duration` (`hours`, decimal)
  - `Sleep Efficiency (%)` → `sleep_efficiency` (`%`)
- **Missing values:** `NA` / `No Data` → `null` (never `0`).

---

## 6. Limitations & Product Display Scope

1. **Personal vs. Research Separation:**
   - **Personal mode (`PersonalHealthRecord`):** Astronaut's own manual entries or personal CSV imports with real ISO `YYYY-MM-DD` timestamps. Used for personal baseline and self-assessment.
   - **Research mode (`ResearchDatasetRecord`):** OSD-575 (CMP), OSD-569 (CBC), and UTMB Actigraphy (`GROUND_ANALOG`), shown with study context (`study_timepoint`, `study_phase`, `source_subject_id`) without mixing into personal baselines.
   - **Scientific Evidence (`ResearchAggregate`):** Apollo AP005 cardiovascular cohort summaries, displayed as historical spaceflight reference context only.
2. **Terrestrial reference ranges** in OSD-575/OSD-569 are laboratory ranges from the source assay and must **not** be treated as clinical thresholds for astronauts in microgravity.
