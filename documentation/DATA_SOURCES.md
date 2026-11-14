# Data Sources

Provenance record for the original NASA files. Raw files are retained unchanged; all normalized outputs are copies under `data/processed/`.

| Dataset | Local path | Official source and provenance / status |
| --- | --- | --- |
| Comprehensive metabolic panel (CMP) | `data/raw/blood/OSD-575/OSD-575-LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` | [NASA OSDR OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575), *SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays*. Local ISA metadata identifies serum samples, Quest Diagnostics, and a Beckman Coulter AU5800. Download date pending. |
| Complete blood count (CBC) | `data/raw/blood/OSD-569/OSD-596-LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | [NASA OSDR OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) documents the Inspiration4 whole-blood CBC assay and matching ground timepoints. The local file has 28 whole-blood samples with the same four participant codes and seven timepoints. Its original filename says OSD-596 and is intentionally unchanged. The official [OSD-596 record](https://osdr.nasa.gov/bio/repo/data/studies/OSD-596) is an unrelated *Drosophila* study. Download date pending; CBC ISA metadata was not included locally. |
| OSD-575 ISA metadata | `data/raw/blood/OSD-575/OSD-575_metadata_OSD-575-ISA/` | Metadata accompanying [NASA OSDR OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575). Includes investigation, sample, and assay tables for CMP and multiplex panels. |
| UTMB Campaign 1 actigraphy | `data/raw/sleep/UTMB_Campaign_1/` | BRSMACT actigraphy export and query-result files. NASA Life Sciences Data Archive portal: [NASA Life Sciences Portal](https://nlsp.nasa.gov/explore/lsdahome). The exact catalog record URL and download dates are not present in the supplied files. The three local packages contain identical data files; one copy is used for processing. |
| Apollo cardiovascular data (AP005) | `data/raw/cardiovascular/AP005_1794688852628/` | Apollo Flight Crew Cardiovascular Evaluations (AP005), from the [NASA Life Sciences Data Archive portal](https://nlsp.nasa.gov/explore/lsdahome); the spreadsheets identify the NASA archive and AP005. The exact catalog record URL and download date are not present in the supplied files. The three original workbooks are retained. |

## Provenance Still to Complete

Add the download date for each source and the exact archive record URLs for UTMB Campaign 1 and AP005 when available. Preserve source-published checksums alongside the original downloads. Files under `data/raw/` are not modified.
