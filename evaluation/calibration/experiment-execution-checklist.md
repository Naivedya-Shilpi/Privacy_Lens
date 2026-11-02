# PrivacyLens — Reproducible Experiment Execution Checklist

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Status:** Pre-Execution Readiness Checklist (Do Not Execute Live Calls Until Phase 5 Approval)

---

## Phase A: Pre-Flight Environment & Partition Verification (Offline)

- [ ] **A.1 Verify Source Dataset Integrity:**
  - Confirm `datasets/Annotated Privacy Policies of 100 Online Platforms/` contains unmodified `PP_table Tagger1.xlsx`, `PP_table Tagger2.xlsx`, `Instruction.docx`, `Tagger 1/` (97 PDFs), and `Tagger 2/` (98 PDFs).
- [ ] **A.2 Regenerate & Verify Phase 3 Evaluation CSVs:**
  - Run:
    ```powershell
    python .\scripts\prepare-evaluation-dataset.py
    ```
  - Confirm `total_comparison_slot_records = 900` and `usable_test_cases_count = 718` (`580` consensus clauses with `requires_human_review = False`).
- [ ] **A.3 Verify Disjoint Dev/Eval Partition Loading:**
  - Run:
    ```powershell
    python .\scripts\verify-evaluation-partitions.py
    ```
  - Confirm `"verification_passed": true`:
    - `dev_calibration_partition`: `10` clauses across `2` platforms (`Cisco`, `Telegram`).
    - `eval_english_498_partition`: `498` clauses across `75` held-out English platforms (`0` overlap with dev).
    - `eval_multilingual_570_partition`: `570` clauses across `85` held-out platforms (`0` overlap with dev).
- [ ] **A.4 Verify Prompt Templates Are Frozen:**
  - Confirm no modifications have been made to:
    - [`prompts/versions/baseline-v1.md`](../../prompts/versions/baseline-v1.md)
    - [`prompts/versions/chained-v2.md`](../../prompts/versions/chained-v2.md)
    - [`prompts/versions/verified-v3.md`](../../prompts/versions/verified-v3.md)

---

## Phase B: Calibration Run & Human Scorer Alignment (10 Dev Clauses + `SYNTH-001`)

- [ ] **B.1 Execute Calibration Runs Only:**
  - Run Prompt V1, Prompt V2, and Prompt V3 **only** on `SYNTH-001` and the `10` calibration clauses (`PL-TC-0061`..`0065` and `PL-TC-0605`..`0609`) at `temperature = 0.0`.
- [ ] **B.2 Validate V1 Post-Hoc Normalizer:**
  - Verify that V1's native bulleted prose is deterministically mapped into the evaluation schema without modifying V1's claims or adding quotes.
- [ ] **B.3 Blinded Team Scoring & IRR Verification:**
  - Mask `promptVersion` labels (`Run-Alpha`, `Run-Beta`, `Run-Gamma`).
  - Have all 4 team members independently score the calibration outputs in [`human-scoring-agreement-sheet.csv`](./human-scoring-agreement-sheet.csv).
  - Verify inter-rater reliability ($\kappa \ge 0.75$ / $\alpha \ge 0.75$) and adjudicate any disagreements using [`scorer-training-guide.md`](./scorer-training-guide.md).

---

## Phase C: Held-Out Benchmark Execution (498 English Consensus + 72 Polish + 15 Full Policies)

- [ ] **C.1 Configure Provider Credentials Safely:**
  - Populate local `server/.env` (git-ignored) and verify `git status` shows zero tracked secret files.
- [ ] **C.2 Execute Held-Out Clause Runs (`temp = 0.0`, Stateless Context):**
  - Execute V1 (`1` call/item), V2 (`3` calls/item), and V3 (`4` calls/item) across identical `{{POLICY_TEXT}}` inputs from `eval_english_498_partition` (and `eval_multilingual_570_partition`).
  - Log raw model outputs, latency (ms), token counts, and `stage4_claims_removed_count` to immutable JSONL run logs.
- [ ] **C.3 Execute Held-Out Full-Policy Runs (15 Stratified PDFs + `SYNTH-001`):**
  - Run V1, V2, and V3 on full policy texts to evaluate **M4 (Third-Party Sharing)**, **M5 (User Rights)**, and **M8 (Missing-Information Handling)** where all 10 metrics are active.

---

## Phase D: Scoring, Statistical Testing & Final Reporting

- [ ] **D.1 Automated Pre-Checks:**
  - Run automated checks for JSON schema validity and verbatim substring verification of `supportingExcerpt` against `<UNTRUSTED_POLICY_TEXT>`.
- [ ] **D.2 Blinded Human Rubric Scoring & 20% Double-Scoring Audit:**
  - Score applicable metrics (**M1, M2, M3, M6, M7, M9, M10** on isolated clauses; **M1–M10** on full policies) in [`../score-sheet-template.csv`](../score-sheet-template.csv).
  - Independently double-score at least 20% of held-out outputs (`100` clauses + all `15` full policies) and compute final Cohen's $\kappa$ / Krippendorff's $\alpha$.
- [ ] **D.3 Compute Composite Scores & Statistical Significance:**
  - Compute **Composite Score A (Full Applicable Score)**, **Composite Score B (Substantive Score excluding M7)**, and **Hallucination Rate ($\text{HR}$)**.
  - Run paired Wilcoxon signed-rank tests comparing V1 vs. V2 and V2 vs. V3, and populate Tables 5.1 and 5.2 in [`../experiment-design.md`](../experiment-design.md).
