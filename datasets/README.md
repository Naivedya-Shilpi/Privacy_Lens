# PrivacyLens — Datasets & Evaluation Corpus Guide

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University

---

## 1. Role of Datasets in PrivacyLens

**PrivacyLens does not fine-tune or train any machine-learning model.** Instead, the system evaluates how progressive prompt engineering architectures (**Prompt V1 Baseline**, **Prompt V2 Chained**, and **Prompt V3 Independently Verified**) perform across foundation models. Privacy policy documents and annotated clauses serve strictly as **held-out evaluation benchmarks** and **calibration test cases**.

### Included vs. Local-Only Dataset Files

| Resource | Path | Tracked in Git? | Reason |
| :--- | :--- | :---: | :--- |
| **Synthetic Test Policy (`SYNTH-001`)** | [`../evaluation/test-cases/synthetic-policy.json`](../evaluation/test-cases/synthetic-policy.json) | **Yes** | Original fictional policy created by Team ladybug for deterministic unit testing. |
| **Primary Research Dataset (`100 Online Platforms`)** | `datasets/Annotated Privacy Policies of 100 Online Platforms/` | **No (`.gitignore`)** | Contains 195 third-party commercial privacy policy PDFs and source Excel workbooks. Excluded from public GitHub to respect third-party policy copyright and repository size limits. |
| **Generated Full-Corpus Clause CSVs** | `evaluation/dataset/annotated-test-cases.csv` & `annotation-comparison.csv` | **No (`.gitignore`)** | Contains 718–900 extracted third-party policy clauses; deterministically regenerated locally in ~1 second via `scripts/prepare-evaluation-dataset.py`. |
| **Preparation & Verification Scripts** | [`../scripts/prepare-evaluation-dataset.py`](../scripts/prepare-evaluation-dataset.py) & [`../scripts/verify-evaluation-partitions.py`](../scripts/verify-evaluation-partitions.py) | **Yes** | Project-specific Python scripts that build and verify the evaluation CSVs locally. |
| **Data Quality Audit & Score Templates** | [`../evaluation/dataset/data-quality-report.md`](../evaluation/dataset/data-quality-report.md) & [`../evaluation/score-sheet-template.csv`](../evaluation/score-sheet-template.csv) | **Yes** | Contains aggregate statistics, structural schemas, and methodology without redistributing bulk copyrighted policy text. |

---

## 2. Primary Research Corpus Attribution & Copyright Notice

Our Phase 3 and Phase 4 evaluation pipeline uses the academic research dataset:

- **Dataset Title:** *Annotated Privacy Policies of 100 Online Platforms*
- **License of Research Annotations:** Creative Commons Attribution 4.0 International (**CC BY 4.0**)
- **Important Copyright & Redistribution Distinction:**
  1. While the researchers' coding methodology (`Instruction.docx`) and binary/structural annotations (`GenData`, `GenUse`, `NoDist`) are released under **CC BY 4.0**, the **195 source PDF files** (`Tagger 1/` and `Tagger 2/`) are snapshots of commercial privacy policies authored by 98 respective online platforms (e.g., Apple, Google, Dropbox, Spotify, Adobe, Microsoft), which retain their original copyright over the policy documents.
  2. Therefore, in accordance with academic best practices and copyright safety, **we do not redistribute the raw PDFs, original Excel spreadsheets, or bulk-extracted clause CSVs in our public GitHub repository**.

---

## 3. Instructions for Teammates: How to Set Up the Dataset Locally

After cloning this repository, teammates can set up the full local evaluation dataset in three steps:

### Step 1: Obtain the Dataset Archive
Obtain the *"Annotated Privacy Policies of 100 Online Platforms"* dataset archive from the official academic repository / course shared drive and extract it into the `datasets/` directory so that the folder path matches:

```text
<repo-root>/datasets/Annotated Privacy Policies of 100 Online Platforms/
|-- Instruction.docx
|-- PP_table Tagger1.xlsx
|-- PP_table Tagger2.xlsx
|-- Tagger 1/          (97 PDF files)
|-- Tagger 2/          (98 PDF files)
```

### Step 2: Generate the Local Evaluation CSVs
From the repository root, activate your Python environment (with `pandas` and `openpyxl` installed via `pip install -r requirements.txt`) and run:

```powershell
python .\scripts\prepare-evaluation-dataset.py
```

This script reads `PP_table Tagger1.xlsx` and `PP_table Tagger2.xlsx` in read-only mode (never modifying the source files) and generates:
- `evaluation/dataset/annotation-comparison.csv` (900 slot-level comparison records)
- `evaluation/dataset/annotated-test-cases.csv` (718 usable clause-level test cases, including the 580 consensus clauses)

### Step 3: Verify the Disjoint Development & Held-Out Evaluation Partitions
Run the partition verifier:

```powershell
python .\scripts\verify-evaluation-partitions.py
```

Expected output confirms `"verification_passed": true` with:
- **10 Development / Calibration Clauses** (`Cisco` and `Telegram`)
- **498 Held-Out English Consensus Clauses** (75 English platforms)
- **570 Held-Out Multilingual Consensus Clauses** (85 platforms)
- **0 Overlap** between development and evaluation partitions.

---

## 4. Optional Secondary Benchmark Resource (Kaggle)

As noted in Phase 1, the team may also optionally reference [https://www.kaggle.com/datasets/deborareis/privacy-policies](https://www.kaggle.com/datasets/deborareis/privacy-policies) in future phases if additional raw policy text samples are desired. It is not downloaded or required for the current foundation and evaluation pipeline.
