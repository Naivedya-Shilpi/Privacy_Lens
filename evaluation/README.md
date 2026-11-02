# PrivacyLens — Evaluation Framework

This directory contains the evaluation methodology, scoring rubric, and benchmark test cases used to compare prompt architectures (**V1 Baseline**, **V2 Chained Extraction + Explanation**, and **V3 Chained + Verification**) across AI providers (**OpenAI**, **Google Gemini**, and **Anthropic Claude**).

---

## Contents

- [`protocol.md`](./protocol.md) — **Phase 4 Evaluation Protocol:** Defines benchmark partitions (`580` consensus clauses & `498` held-out English consensus subset with zero dev/eval platform overlap), input standardization, multi-label clause handling, isolated-clause `N/A` rules for M4/M5/M8, fair V1 normalization, and a clearly labeled hypothetical scoring walkthrough across V1, V2, and V3.
- [`scoring-rubric.md`](./scoring-rubric.md) — **Phase 4 Detailed 10-Metric Scoring Rubric:** Defines ordinal `0–2` criteria, weights, mutually exclusive M10 thresholds, orthogonal separation between M7 (quotations) and M10 (hallucination rate), and concrete examples for all 10 metrics (M1–M10).
- [`experiment-design.md`](./experiment-design.md) — **Phase 4 Experimental Design Specification:** Pre-registers hypotheses ($\text{H}_1$–$\text{H}_4$), independent/dependent variables, blinded human evaluation protocol, and unpopulated results tables.
- [`score-sheet-template.csv`](./score-sheet-template.csv) — Standardized CSV score-sheet template for recording M1–M10 scores, hallucination rates, and composite scores (pre-populated only with 3 rows marked `is_hypothetical_example = TRUE` corresponding to the walkthrough in `protocol.md`).
- [`calibration/calibration-checklist.md`](./calibration/calibration-checklist.md) — Step-by-step pre-execution calibration checklist for the 4 members of Team ladybug.
- [`calibration/scorer-training-guide.md`](./calibration/scorer-training-guide.md) — Scorer training instructions, atomic claim counting rules, and formal 3-step human scorer disagreement resolution protocol.
- [`calibration/human-scoring-agreement-sheet.csv`](./calibration/human-scoring-agreement-sheet.csv) — Pre-structured agreement sheet for the 10 development clauses (`Telegram` & `Cisco`) and `SYNTH-001`.
- [`calibration/experiment-execution-checklist.md`](./calibration/experiment-execution-checklist.md) — End-to-end reproducible experiment execution checklist.
- [`evaluation-rubric.md`](./evaluation-rubric.md) — High-level Phase 1 7-dimension rubric overview.
- [`test-cases/synthetic-policy.json`](./test-cases/synthetic-policy.json) — A controlled, fictional privacy policy (`SYNTH-001`) with known ground-truth clauses, deliberate ambiguities, and omitted sections designed for deterministic unit evaluation.
- [`dataset/README.md`](./dataset/README.md) — Documentation for the structured evaluation dataset prepared in Phase 3 from *"Annotated Privacy Policies of 100 Online Platforms"*.
- [`dataset/annotated-test-cases.csv`](./dataset/annotated-test-cases.csv) — **718** usable clause-level test cases (`PL-TC-0001` to `PL-TC-0718`) across 98 verified platforms (`GenData`, `GenUse`, `NoDist`), including **580** high-confidence consensus clauses.
- [`dataset/annotation-comparison.csv`](./dataset/annotation-comparison.csv) — Full **900-record** side-by-side comparison matrix (`100 platforms × 9 clause slots`) between Annotator 1 and Annotator 2.
- [`dataset/data-quality-report.md`](./dataset/data-quality-report.md) — Detailed audit of annotator agreements, disagreements, missing values, PDF correspondence, and records flagged for human review.

---

## Evaluation Principles

1. **No Fabricated Metrics:** All scores and comparison tables will only be recorded after executing controlled benchmark runs against documented test policies.
2. **Ground-Truth Verification:** Every test case in `test-cases/` defines expected findings, ambiguous clauses, and intentionally omitted disclosures so evaluators can objectively verify whether each prompt version detects both present and missing information.
3. **Cross-Provider Fairness:** Identical policy text inputs and temperature/decoding settings (where supported) will be used when comparing OpenAI, Gemini, and Claude.
