# PrivacyLens — Phase 3 Data Quality & Annotator Comparison Report

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Dataset Inspected:** `datasets/Annotated Privacy Policies of 100 Online Platforms/`

---

## 1. Executive Summary of Verified Counts

All counts below were programmatically verified from `PP_table Tagger1.xlsx`, `PP_table Tagger2.xlsx`, `Tagger 1/`, and `Tagger 2/` using [`scripts/prepare-evaluation-dataset.py`](../../scripts/prepare-evaluation-dataset.py):

| Metric | Verified Count | Notes |
| :--- | :---: | :--- |
| **Total Platform Rows in Spreadsheets** | **100** | Rows 2–101 in both `PP_table Tagger1.xlsx` and `PP_table Tagger2.xlsx` |
| **Annotated Platforms (Verified)** | **98** | 98 platforms have binary labels and extracted policy clauses |
| **Unannotated / Excluded Platforms** | **2** | `iCloud` (Excel Row 4) and `YouTube` (Excel Row 79) — all labels & clauses are `NaN`, and neither has a PDF in `Tagger 1/` or `Tagger 2/` |
| **Source PDFs in `Tagger 1/`** | **97** | Unannotated PDF snapshots (`SQUARE ENIX.pdf` is missing from `Tagger 1/`) |
| **Source PDFs in `Tagger 2/`** | **98** | Covers all 98 annotated platforms; **94 PDFs** contain embedded `/Highlight` and `/Popup` annotations |
| **Non-Empty Clause Cells in Tagger 1** | **700** | `GenData`: 258 \| `GenUse`: 275 \| `NoDist`: 167 |
| **Non-Empty Clause Cells in Tagger 2** | **705** | `GenData`: 259 \| `GenUse`: 278 \| `NoDist`: 168 |
| **Total `(Platform, Clause Slot)` Pairs** | **900** | `100 platforms × 9 clause slots` (`annotation-comparison.csv`) |
| **Populated Clause Slots (At Least 1 Annotator)** | **721** | `900 total slots - 179 both_empty slots` |
| **Excluded Slot Records** | **182** | `179 both_empty slots` + `3 misattributed Tagger 1-only row-shift slots in OVH` |
| **Total Usable Clause Records (`annotated-test-cases.csv`)** | **718** | **580** consensus clauses (`requires_human_review = False`) + **138** overlapping/single-annotator/divergent records (`requires_human_review = True`) |

---

## 2. Two-Level Annotator Comparison (Tagger 1 vs. Tagger 2)

### 2.1 Level A: Platform-Category Binary Labels (`100 Platforms × 3 Categories = 300 Pairs`)

At the binary category level (`GenData`, `GenUse`, `NoDist`), the two spreadsheets exhibit **100% agreement across all 98 annotated platforms** (indicating that binary category flags were either reconciled prior to table publication or agreed upon across all 98 analyzed policies):

| Category | Both `1` (`agree_1`) | Both `0` (`agree_0`) | Binary Disagreements (`1` vs `0`) | Both Missing (`NaN`) | Total Platforms |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`GenData`** | 98 | 0 | 0 | 2 (`iCloud`, `YouTube`) | 100 |
| **`GenUse`** | 97 | 1 (`Signal`) | 0 | 2 (`iCloud`, `YouTube`) | 100 |
| **`NoDist`** | 89 | 9 (`Signal`, `Crypto.com`, `Spotify`, `Quora`, `adidas`, `FREE NOW`, `DingTalk`, `Pracuj.pl`, `ZipRecruiter`) | 0 | 2 (`iCloud`, `YouTube`) | 100 |
| **Total (300 Pairs)** | **284** | **10** | **0** | **6** | **300** |

### 2.2 Level B: Clause-Slot Level Comparison (`100 Platforms × 9 Clause Slots = 900 Slots`)

While binary category labels match across the 98 annotated platforms, **substantial differences exist in the specific supporting clauses extracted by Tagger 1 and Tagger 2**:
- **71 platforms** (including the 2 empty rows) have identical clause slots across all 9 columns.
- **29 platforms** differ in one or more clause example columns (`Baidu AI Cloud`, `Dropbox`, `Oktawave`, `OVH`, `Discord`, `GG`, `Signal`, `Telegram`, `Zoom`, `Badoo`, `Blik`, `PAYBACK`, `PayPay`, `DoorDash`, `Krakowskie Smaki`, `Clash of clans (supercell)`, `FollowMyHealth`, `Aliexpress`, `Vinted`, `ALBICLA`, `adidas`, `BlaBlaCar`, `FREE NOW`, `Hotels.com`, `moBiLET`, `Adobe`, `ABEMA`, `DingTalk`, `ZipRecruiter`).

Across all **900** `(platform, clause_slot)` pairs in [`annotation-comparison.csv`](./annotation-comparison.csv):

| Agreement Status (`agreement_status`) | Slot Count | Included in `annotated-test-cases.csv`? | Requires Human Review? | Description |
| :--- | :---: | :---: | :---: | :--- |
| **`exact_clause_agreement`** | **571** | Yes (571) | No | Both annotators extracted the exact same clause in the same slot (after whitespace normalization). |
| **`formatting_or_typo_variation`** | **9** | Yes (9) | No | Both annotators selected the exact same clause, with minor hyphenation, spacing, or PDF column word-order differences (e.g., `Dropbox` `GenUse1`, `FREE NOW` `GenUse1`, `adidas` `DataExamp3`). |
| **`partial_clause_overlap`** | **15** | Yes (15) | Yes | Both annotators selected overlapping text spans from the same paragraph (e.g., one included an adjacent sentence or heading, as in `moBiLET` `DataExamp1`), or placed the identical clause in a different slot number within the same category (`ZipRecruiter` `GenUse2` vs. `GenUse3`). |
| **`clause_selection_disagreement`** | **89** | Yes (89) | Yes | Both annotators coded the category as `1`, but selected different clauses from the policy as evidence for that slot (includes 12 dual-populated slots in `Oktawave` and `OVH` affected by Tagger 1's row shift). Both clauses are preserved verbatim. |
| **`tagger1_only_clause`** | **13** | Yes (13) | Yes | Tagger 1 provided an additional example clause (`Examp2`/`Examp3`), while Tagger 2 left that slot blank. |
| **`tagger2_only_clause`** | **21** | Yes (21) | Yes | Tagger 2 provided an additional example clause (`Examp2`/`Examp3`), while Tagger 1 left that slot blank. |
| **`tagger1_only_misattributed_row_shift`** | **3** | **Excluded (3)** | Yes | In `OVH` (`DataExamp3`, `NoDist2`, `NoDist3`), Tagger 1's cells contain `Discord` policy clauses due to a 1-row upward paste shift in `PP_table Tagger1.xlsx`, while Tagger 2 left those slots blank. Excluded from usable test cases to prevent evaluating `Discord` clauses under `OVH`. |
| **`both_empty_unused_slot`** | **131** | **Excluded (131)** | No | Unused secondary/tertiary slots (`Examp2`/`Examp3`) on platforms where the category is `1` (`Instruction.docx` requires *"up to 3 clauses"*). |
| **`both_empty_negative_category`** | **30** | **Excluded (30)** | No | All 3 slots are appropriately blank because both annotators labeled the category `0` (`1 × 3 = 3` slots for `Signal` `GenUse=0`; `9 × 3 = 27` slots for `NoDist=0`). |
| **`missing_unannotated_platform`** | **18** | **Excluded (18)** | No | All 9 slots for `iCloud` (9) and `YouTube` (9), which were not annotated in either spreadsheet. |
| **TOTAL** | **900** | **718 Usable / 182 Excluded** | **138 Usable Flagged** | |

---

## 3. Critical Data Quality Findings & Anomalies Discovered

### 3.1 Spreadsheet Row-Shift Error in `PP_table Tagger1.xlsx` (Rows 4 & 5: `Oktawave` and `OVH`)
Cross-row clause verification and PDF text matching revealed a critical data-entry error in `PP_table Tagger1.xlsx`:
- Following the blank row for `iCloud` (Excel Row 4), **Tagger 1's clause columns for Excel Row 5 (`Oktawave`) and Excel Row 6 (`OVH`) were shifted upward by 1 row**:
  - In `PP_table Tagger1.xlsx` Row 5 (`Oktawave`), the 6 populated clauses (`DataExamp1..2`, `GenUse1..3`, `NoDist1`) do **not** exist in `Oktawave.pdf`—they are verbatim quotes from **`OVH.pdf`** (and match Tagger 2's Row 6 `OVH` verbatim).
  - In `PP_table Tagger1.xlsx` Row 6 (`OVH`), the 9 populated clauses (`DataExamp1..3`, `GenUse1..3`, `NoDist1..3`) do **not** exist in `OVH.pdf`—they are verbatim quotes from **`Discord.pdf`** (and match Tagger 2's Row 7 `Discord` verbatim).
- **How We Handled This Without Modifying Source Files:**
  - The original Excel files remain untouched.
  - The **3 slots** in `OVH` (`DataExamp3`, `NoDist2`, `NoDist3`) where only Tagger 1 had a clause (from `Discord.pdf`) and Tagger 2 was blank are excluded from `annotated-test-cases.csv` (`tagger1_only_misattributed_row_shift`).
  - The **12 slots** in `Oktawave` (6) and `OVH` (6) where both Tagger 1 and Tagger 2 populated clauses are retained in `annotated-test-cases.csv` with `requires_human_review = True` and an explicit `DATA QUALITY ALERT` in `notes_on_ambiguity` explaining that Tagger 2's clause is verified against the platform's PDF while Tagger 1's clause is shifted by 1 row.

### 3.2 Slot Numbering Gaps (`TikTok` and `adidas`)
In two platforms, annotators left the first example slot (`GenUse1`) blank while populating `GenUse2` (and `GenUse3`):
- **Row 58 (`TikTok` — Excel Row 60):** Both Tagger 1 and Tagger 2 left `GenUse1` empty while populating `GenUse2` and `GenUse3`.
- **Row 61 (`adidas` — Excel Row 63):** Tagger 2 left `GenUse1` and `GenUse3` empty while populating `GenUse2` (whereas Tagger 1 populated `GenUse1` and `GenUse2`).
- All non-empty slots are preserved with their original column identifiers and flagged in `notes_on_ambiguity`.

### 3.3 Multi-Category Clause Overlap (Same Clause Assigned to Multiple Categories)
Because a single sentence in a privacy policy can simultaneously deploy vague usage terms (`GenUse`) and fail to link specific data categories to specific purposes (`NoDist`), annotators frequently pasted the **exact same sentence into both `GenUse` and `NoDist`** (or `GenData` and `GenUse`).
- Across the **718** usable slot records in `annotated-test-cases.csv`, **272 records** involve a clause that also appears in another category slot for the same platform (consistent with `Tagger 2/` PDF highlights labeled `GenUse1\rNoDistinction1`).
- Every such record is explicitly annotated with `Multi-category overlap: ...` in `notes_on_ambiguity`.

### 3.4 Non-English (Polish) Policy Clauses (12 Platforms)
Although 86 of the 98 annotated platforms contain English-language clauses, **12 platforms** were analyzed using Polish-language privacy policies and contain Polish clause text in both spreadsheets and PDFs:
- `Sympatia.pl`, `PAYBACK`, `Krakowskie Smaki`, `ZnanyLekarz`, `Tidal`, `Amazon` (`Amazon.pl.pdf`), `Vinted`, `Zalando`, `ALBICLA`, `iTaxi`, `moBiLET`, and `Yanosik` (**89 usable clause records**).
- These records are tagged with `"Clause text is in Polish (matches Polish-language source PDF)."` in `notes_on_ambiguity` so evaluation scripts can either test multilingual prompt robustness or filter to English-only subsets.

### 3.5 Metadata Date Discrepancies (2 Platforms)
- **`Ubisoft` (Excel Row 40):** `date` is recorded as `MAY 2021` in `PP_table Tagger1.xlsx` vs. `MAY 2020` in `PP_table Tagger2.xlsx`.
- **`Microsoft` (Excel Row 87):** `date` is recorded as `DEC 2019` in `PP_table Tagger1.xlsx` vs. `DEC 2021` in `PP_table Tagger2.xlsx`.

---

## 4. Correspondence Between Annotated Clauses and Source PDF Policies

1. **Filename Resolution Across 98 Annotated Platforms:**
   - **92 annotated platforms** match `<platform_name>.pdf` directly (after stripping the leading `!` prefix on `!FREE NOW.pdf`, `!OVH.pdf`, `!Signal.pdf`, and `!Telegram.pdf` in `Tagger 2/`).
   - **2 platforms** have trailing spaces in either the spreadsheet or PDF filename (`'Tinder '` in Excel $\leftrightarrow$ `Tinder.pdf`; `'Dailymotion'` in Excel $\leftrightarrow$ `'Dailymotion .pdf'`).
   - **4 platforms** use parent/regional PDF filenames:
     - `Amazon` $\leftrightarrow$ `Amazon.pl.pdf`
     - `Clash of clans (supercell)` $\leftrightarrow$ `Supercell.pdf`
     - `Fortinite (Epic games)` $\leftrightarrow$ `Epic Games.pdf`
     - `The Witcher: Monster Slayer` $\leftrightarrow$ `The Witcher Monster Slayer.pdf`
   - **`SQUARE ENIX`:** Present in `Tagger 2/SQUARE ENIX.pdf`, absent from `Tagger 1/`.
2. **Direct Text Verification in Source PDFs:**
   - **Tagger 1 (`682 / 700` clauses = 97.4%):** Match directly inside the platform's source PDF via normalized alphanumeric substring matching. Of the 18 non-matching cells, **15** are the row-shifted `Oktawave`/`OVH` clauses (which match `OVH.pdf` and `Discord.pdf` 100%), and **3** (`Sympatia.pl` `GenUse2`/`NoDist2` and `Spotify` `DataExamp2`) have minor PDF character-encoding/truncation artifacts (`"Spotif"`).
   - **Tagger 2 (`698 / 705` clauses = 99.0%):** Match directly inside the platform's source PDF. The remaining **7** clauses (`GG` `GenUse2`, `Sympatia.pl` `GenUse2`/`NoDist2`, `Spotify` `DataExamp2`, and `BlaBlaCar` `DataExamp1`/`GenUse1`/`NoDist1`) are verbatim extractions from multi-column or table layouts in the PDF where PDF text-stream ordering interleaved words across lines.
3. **Embedded PDF Markup Annotations:**
   - **`Tagger 1/` (97 PDFs):** Contains 0 embedded `/Highlight` or `/Popup` PDF annotation objects.
   - **`Tagger 2/` (98 PDFs):** **94 PDFs** contain embedded `/Highlight`, `/Popup`, and `/Text` annotations whose `/Contents` explicitly state the category tag (e.g., `GenData1`: 281 highlights, `GenUse1`: 254 highlights, `GenUse1\rNoDistinction1`: 86 highlights, `NoDistinction1`: 80 highlights) along with candid annotator comments (e.g., `'GenData1 (why "device" is data?)'`, `'GenUse1\rNoDistinction!\r\rPlaced in a weird place'`). Only 4 PDFs in `Tagger 2/` (`ABEMA.pdf`, `Adobe.pdf`, `Dropbox.pdf`, `Evernote.pdf`) lack embedded PDF markup objects.

---

## 5. Limitations and Decisions Requiring Human Review

### 5.1 Dataset Limitations for PrivacyLens (Problem Statement C18)
1. **Focus on Vague/Broad Wording (`GenData`, `GenUse`, `NoDist`):**
   - The source corpus specifically annotates **vague data collection (`GenData`)**, **vague data usage (`GenUse`)**, and **unlinked data-to-purpose clauses (`NoDist`)**. While this directly aligns with PrivacyLens's detection of **Potentially Concerning / Broad Wording**, it does not directly annotate user rights (deletion/access mechanics) or data retention durations. Therefore, PrivacyLens should pair this 98-platform clause benchmark with full-policy evaluation tests (such as `SYNTH-001` and selected full PDF policies from `Tagger 2/`).
2. **Presence of Polish-Language Policies (12 Platforms):**
   - Evaluating English prompts on Polish clauses tests cross-lingual generalization; if English-only evaluation is desired, human reviewers should filter out records where `notes_on_ambiguity` contains `"Clause text is in Polish"`.

### 5.2 Decisions Requiring Human Review (`requires_human_review = True`, 138 Records)
1. **Adjudicating `Oktawave` and `OVH` (12 Usable Records + 3 Excluded Slots):**
   - Human reviewers should confirm using **Tagger 2's clauses** as the ground-truth text for `Oktawave` (Excel Row 5) and `OVH` (Excel Row 6), since PDF verification proves Tagger 1's Row 5 and Row 6 were shifted upward by 1 row.
2. **Adjudicating the 77 Remaining `clause_selection_disagreement` Slots Across 23 Platforms:**
   - When both annotators agreed a category (`GenData`, `GenUse`, or `NoDist`) was `1` but extracted different representative sentences from the same policy, both clauses are valid candidate examples from the policy. Reviewers should decide whether to treat **both** clauses as valid ground-truth targets (union evaluation) or restrict primary benchmarking to the **580 consensus clauses** (`requires_human_review = False`).
3. **Adjudicating the 34 Single-Annotator Slots (`13 tagger1_only_clause` + `21 tagger2_only_clause`):**
   - Where one annotator extracted 3 examples and the other extracted 1 or 2 examples for an agreed `1` category, reviewers should confirm whether to include these supplementary examples in the secondary benchmark tier.
