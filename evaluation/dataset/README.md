# PrivacyLens — Phase 3 Evaluation Dataset Documentation

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Source Corpus:** *Annotated Privacy Policies of 100 Online Platforms* (`datasets/Annotated Privacy Policies of 100 Online Platforms/`)

---

## 1. Purpose and Scope

This directory contains the structured **evaluation dataset** prepared from the research corpus *"Annotated Privacy Policies of 100 Online Platforms"*.

- **Evaluation-Only Usage:** In accordance with our prompt-engineering research design, this dataset is strictly reserved for **evaluating and benchmarking** Prompt V1 (`baseline-v1`), Prompt V2 (`chained-v2`), and Prompt V3 (`verified-v3`). We are **not** fine-tuning or training any model on these records.
- **Non-Destructive Pipeline:** All source files in `datasets/Annotated Privacy Policies of 100 Online Platforms/` (`PP_table Tagger1.xlsx`, `PP_table Tagger2.xlsx`, `Instruction.docx`, `Tagger 1/`, and `Tagger 2/`) are preserved unmodified.
- **No Fabricated or Silently Resolved Labels:** Both annotators' labels and extracted clause texts are preserved side-by-side. Where annotators selected different clauses or where spreadsheet data-entry anomalies exist, records are explicitly flagged with `requires_human_review = True` and detailed in [`data-quality-report.md`](./data-quality-report.md).

---

## 2. Source Corpus Structure

### 2.1 Annotator Guidelines (`Instruction.docx`)
The source study evaluates whether the wording of a platform's privacy policy enables a consumer to understand what data is collected, how it is used, and which specific data is used for which purpose—or whether vague language grants the company broad flexibility. It defines three binary annotation categories (`1 = Yes`, `0 = No`), each accompanied by up to 3 verbatim supporting clause examples when coded `1`:

| Category Code | spreadsheet Binary Column | Clause Example Columns (up to 3) | Definition (`Instruction.docx`) |
| :--- | :--- | :--- | :--- |
| **`GenData`** | `GenData` | `DataExamp1`, `DataExamp2`, `DataExamp3` | Is there a clause describing what categories of data are collected that deploys such a general term, potentially followed by an open catalogue of examples, that it is not clear to the consumer what kinds of information will be gathered? (`1 = Yes`, `0 = No`) |
| **`GenUse`** | `GenUse` | `GenUse1`, `GenUse2`, `GenUse3` | Is there a clause describing the ways in which data will be used that deploys such a general term, potentially followed by an open catalogue of examples, that it is not clear to the consumer how exactly her data will be used? (`1 = Yes`, `0 = No`) |
| **`NoDist`** (`NoDistinction`) | `NoDist` | `NoDist1`, `NoDist2`, `NoDist3` | Does the privacy policy feature clauses describing how data will be used that do not explain what data exactly will be used in what way or for what purpose? (`1 = Yes`, `0 = No`) |

### 2.2 Annotator Spreadsheets (`PP_table Tagger1.xlsx` & `PP_table Tagger2.xlsx`)
Both workbooks contain 100 platform rows (`Rows 2–101`) and 20 identical columns:
- **8 Platform Metadata Columns:** `ID` (unpopulated in source), `name`, `url`, `date`, `secto` (sector), `hq` (headquarters country/state), `hq_cat` (HQ region group), `publ` (`Public` vs. `Private`).
- **3 Binary Category Columns:** `GenData`, `GenUse`, `NoDist`.
- **9 Supporting Clause Columns:** `DataExamp1..3`, `GenUse1..3`, `NoDist1..3`.

### 2.3 Source Policy PDFs (`Tagger 1/` & `Tagger 2/`)
- **`Tagger 1/` (97 PDFs):** Clean source PDF snapshots (no embedded `/Highlight` PDF markup objects; `SQUARE ENIX.pdf`, `iCloud`, and `YouTube` are absent).
- **`Tagger 2/` (98 PDFs):** Covers all 98 annotated platforms (including `SQUARE ENIX.pdf`; `iCloud` and `YouTube` are absent). **94 of the 98 PDFs** contain embedded `/Highlight` and `/Popup` PDF annotations where the annotator tagged highlighted passages directly with category codes (e.g., `GenData1`, `GenUse1`, `NoDistinction1`, `GenUse1\rNoDistinction1`) and occasional margin notes.

---

## 3. Generated Evaluation Files

### 3.1 [`annotation-comparison.csv`](./annotation-comparison.csv) — Full 900-Slot Comparison Matrix
Contains all **900** `(platform, clause_slot)` records (`100 platforms × 9 clause slots`), including both populated and empty/excluded slots:
- `comparison_id` (`CMP-0001` to `CMP-0900`)
- `excel_row` (`2` to `101`)
- `platform_name`, `sector`, `hq`, `hq_category`, `company_type`, `policy_url`
- `annotation_category` (`GenData`, `GenUse`, `NoDist`) and `clause_slot` (`DataExamp1..3`, `GenUse1..3`, `NoDist1..3`)
- `annotator_1_label`, `annotator_2_label`, `binary_label_agreement`
- `annotator_1_clause`, `annotator_2_clause`
- `agreement_status`
- `is_excluded`, `exclusion_reason`
- `source_document_reference`
- `notes_on_ambiguity`

### 3.2 [`annotated-test-cases.csv`](./annotated-test-cases.csv) — 718 Usable Clause-Level Test Cases
Contains the **718** non-excluded clause-level test cases (`PL-TC-0001` to `PL-TC-0718`):
- `test_case_id` (`PL-TC-0001` to `PL-TC-0718`)
- `comparison_id` (foreign key to `annotation-comparison.csv`)
- `platform_name`, `sector`
- `original_policy_clause` (consensus clause for agreed slots; explicitly tagged `[DISAGREEMENT - HUMAN REVIEW REQUIRED] Tagger1: ... || Tagger2: ...` when annotators selected different clauses so disagreements are never silently resolved)
- `annotation_category` (`GenData`: 264, `GenUse`: 283, `NoDist`: 171)
- `clause_slot`
- `annotator_1_label` & `annotator_2_label` (records both the category binary label `1`/`0` and whether the annotator populated the specific clause slot)
- `annotator_1_clause` & `annotator_2_clause` (exact normalized clause text from each annotator)
- `agreement_status`
- `requires_human_review` (`False` for the **580** consensus clauses; `True` for the **138** overlapping, single-annotator, or divergent clause slots)
- `clause_selection_source`
- `source_document_reference`
- `notes_on_ambiguity`

### 3.3 [`data-quality-report.md`](./data-quality-report.md)
Comprehensive audit of annotator agreement/disagreement counts, missing values, excluded records, PDF correspondence verification, discovered spreadsheet anomalies (such as the Row 3/Row 4 shift in `PP_table Tagger1.xlsx`), Polish-language clauses, and items requiring human review.

---

## 4. Reproducing the Dataset Locally (Teammate Instructions)

> **Copyright & Repository Hygiene Note:**  
> To respect third-party copyright over the 195 commercial privacy policy PDFs and avoid uploading bulk third-party text to GitHub, the raw source folder (`datasets/Annotated Privacy Policies of 100 Online Platforms/`) and the generated bulk CSVs (`annotated-test-cases.csv` and `annotation-comparison.csv`) are git-ignored.

Once you have placed the *"Annotated Privacy Policies of 100 Online Platforms"* folder inside `<repo-root>/datasets/` (see [`../../datasets/README.md`](../../datasets/README.md)), run the following commands from the repository root:

```powershell
# 1. Install Python dependencies (pandas, openpyxl, pypdf)
python -m pip install -r requirements.txt

# 2. Generate annotation-comparison.csv (900 rows) and annotated-test-cases.csv (718 rows)
python .\scripts\prepare-evaluation-dataset.py

# 3. Verify the disjoint 10-clause Dev and 498/570-clause Held-Out Evaluation partitions
python .\scripts\verify-evaluation-partitions.py
```

The script uses `pandas` and `openpyxl` to read the original Excel spreadsheets and PDF directories in read-only mode and deterministically regenerates `annotation-comparison.csv` and `annotated-test-cases.csv`.
