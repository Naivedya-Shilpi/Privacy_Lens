# PrivacyLens — Phase 4 Team Scorer Calibration Checklist

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug (4 Scorers: `Scorer_1`, `Scorer_2`, `Scorer_3`, `Scorer_4`)  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Status:** Ready for Pre-Execution Calibration (Zero Live Model Calls Executed)

---

## Purpose

Before running or scoring the held-out evaluation benchmark (**498 English consensus clauses** across 75 platforms and **570 multilingual consensus clauses** across 85 platforms), all four members of **Team ladybug** must complete this calibration protocol on the **Disjoint Development / Calibration Partition** (`SYNTH-001` + the **10 real consensus clauses** from `Telegram` and `Cisco`).

---

## Stage 1: Pre-Calibration Preparation (All 4 Scorers)

- [ ] **1.1 Read Core Specifications:**
  - Read [`../protocol.md`](../protocol.md) (partitioning, multi-label rules, isolated-clause `N/A` rules, and V1 post-hoc normalization).
  - Read [`../scoring-rubric.md`](../scoring-rubric.md) (10 metrics **M1–M10**, `0–2` ordinal criteria, and mutually exclusive **M10** thresholds).
  - Read [`./scorer-training-guide.md`](./scorer-training-guide.md) (atomic claim counting rules, M7 vs. M10 distinction, and disagreement resolution protocol).
- [ ] **1.2 Verify Disjoint Partition Loader:**
  - Run `python .\scripts\verify-evaluation-partitions.py` in Windows PowerShell and confirm `"verification_passed": true` with `10` calibration clauses (`Telegram` and `Cisco`), `498` held-out English clauses, `570` held-out multilingual clauses, and `0` overlap.
- [ ] **1.3 Confirm Scorer Role Assignments:**
  - `Scorer_1` (Team Member 1): Primary Scorer — Partition Group A + Full 10-Clause Calibration Set
  - `Scorer_2` (Team Member 2): Primary Scorer — Partition Group B + Full 10-Clause Calibration Set
  - `Scorer_3` (Team Member 3): Independent Double-Scorer — 20% Reliability Audit Set + Full 10-Clause Calibration Set
  - `Scorer_4` (Team Member 4): Adjudication Lead & Blinded Masking Coordinator + Full 10-Clause Calibration Set

---

## Stage 2: Blinded Dry-Run Calibration on `SYNTH-001` and the 10 Calibration Clauses

- [ ] **2.1 Dry-Run on Walkthrough Example (`PL-TC-0004`):**
  - Each scorer independently reviews the 3 hypothetical outputs (`V1`, `V2`, `V3`) in [`../protocol.md` Section 6](../protocol.md) without looking at Section 6.4's score table, assigns scores for **M1–M10**, and verifies that they:
    1. Mark **M4**, **M5**, and **M8** as **`N/A`** on isolated clauses lacking those disclosures.
    2. Score **M7 (Evidence Grounding)** strictly on the verbatim fidelity and relevance of quotations (`supportingExcerpt`), not on whether the explanation contains hallucinations.
    3. Score **M10 (Hallucination Rate)** strictly using the mutually exclusive rules over $(C_{\text{unsupported}}, \text{HR})$.
- [ ] **2.2 Independent Scoring of the 10 Calibration Clauses (`Telegram` & `Cisco`) + `SYNTH-001`:**
  - Once calibration model outputs are generated for the 10 development clauses (`PL-TC-0061`..`0065` and `PL-TC-0605`..`0609`) and `SYNTH-001`, `Scorer_4` masks the prompt version labels (`Run-Alpha`, `Run-Beta`, `Run-Gamma`).
  - All 4 scorers independently grade every run in [`./human-scoring-agreement-sheet.csv`](./human-scoring-agreement-sheet.csv) without discussing scores during grading.

---

## Stage 3: Inter-Rater Agreement Check & Disagreement Adjudication

- [ ] **3.1 Compute Calibration Agreement Metrics:**
  - Compare `Scorer_1`, `Scorer_2`, `Scorer_3`, and `Scorer_4` entries in `human-scoring-agreement-sheet.csv`.
  - Verify exact agreement rate $\ge 80\%$ and Krippendorff's Alpha ($\alpha \ge 0.75$) / pairwise Cohen's Kappa ($\kappa \ge 0.75$) across applicable metrics.
- [ ] **3.2 Resolve Calibration Disagreements:**
  - For any metric on any calibration item where `max_scorer_spread >= 1`, follow the **3-Step Disagreement Resolution Protocol** in [`./scorer-training-guide.md`](./scorer-training-guide.md) and record the final consensus score and rationale in `human-scoring-agreement-sheet.csv`.
- [ ] **3.3 Lock Evaluation Rubric before Held-Out Execution:**
  - Sign off that no changes will be made to prompt templates (`baseline-v1.md`, `chained-v2.md`, `verified-v3.md`) or rubric thresholds after calibration lock.
