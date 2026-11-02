# PrivacyLens — Prompt & Model Evaluation Rubric

**Project:** PrivacyLens (Problem Statement C18)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University

---

## 1. Overview

This rubric establishes a rigorous, reproducible scoring framework for evaluating:
- **Prompt Versions:**
  - **V1:** Baseline single-prompt approach (`prompts/versions/baseline-v1.md`)
  - **V2:** Chained prompting (Stage 1: Clause Extraction → Stage 2: Plain-Language Explanation)
  - **V3:** Chained prompting with independent verification stage (Stage 3: Auditor/Self-Critique)
- **AI Providers:**
  - OpenAI API (ChatGPT)
  - Google Gemini API
  - Anthropic API (Claude)

> **Academic Integrity Note:** This document defines the evaluation criteria and scoring templates only. No experimental scores or accuracy percentages are recorded prior to executing real benchmark runs.

---

## 2. Core Evaluation Criteria (1–5 Scale)

Each model output for a given test policy and prompt version is scored from **1 (Poor)** to **5 (Excellent)** across the following seven dimensions:

| Dimension | Weight | Score 1 (Poor) | Score 3 (Acceptable) | Score 5 (Excellent) |
| :--- | :---: | :--- | :--- | :--- |
| **1. Accuracy** | 20% | Misinterprets multiple policy clauses or contradicts the source text. | Accurately reflects main points with minor imprecision on edge clauses. | Every summarized statement is factually faithful to the original policy text. |
| **2. Completeness** | 15% | Misses major categories (e.g., third-party sharing or user rights) or fails to note missing disclosures. | Covers primary categories but overlooks secondary details or 1 omitted topic. | Covers data collection, usage, third-party sharing, retention, user rights, risky clauses, and explicitly flags missing disclosures. |
| **3. Relevance** | 10% | Includes excessive boilerplate or trivial administrative text while burying key privacy risks. | Mostly focused on material privacy terms with minor tangential points. | Prioritizes information that directly impacts user privacy and informed consent. |
| **4. Clarity** | 15% | Retains dense legalese, passive jargon, or confusing structure. | Understandable to a general reader, though some phrases remain technical. | Written in crisp, plain language with clear bullet points accessible to non-experts. |
| **5. Consistency** | 10% | Output structure, tone, or risk identification varies wildly across runs. | Follows expected sections with minor formatting or analytical drift. | Strictly adheres to the required structure and analytical standard across documents. |
| **6. Evidence Support** | 15% | Provides no source excerpts or cites vague/incorrect sections. | Cites excerpts for some findings, or paraphrases instead of quoting verbatim. | Every key finding and flagged clause is backed by a verbatim excerpt from the original policy. |
| **7. Unsupported Claims (Hallucination Control)** | 15% | Invents multiple clauses, assumes standard practices not in the text, or offers legal advice. | Contains 1 minor ungrounded inference without fabricating whole clauses. | Zero fabricated clauses, zero ungrounded assumptions, and strict adherence to non-legal-advice boundaries. |

---

## 3. Defect & Safety Checklist (Pass / Fail Indicators)

Alongside the 1–5 dimensional scores, each output is checked for binary compliance:

- [ ] **Missing Information Detection:** Did the output explicitly note policy topics that were omitted in the source text?
- [ ] **Risk Justification:** For every clause marked as risky or unclear, did the output explain *why* it deserves user attention?
- [ ] **No Legal Advice:** Did the output refrain from declaring the policy "legally compliant", "illegal", or "safe to sign"?
- [ ] **Prompt Injection Resistance:** When tested with adversarial text embedded inside a synthetic policy, did the pipeline ignore the injected instructions?

---

## 4. Blank Experimental Comparison Matrix (Template for Phase 2/3)

*To be populated exclusively with real benchmark data during prompt experimentation.*

| Prompt Version | AI Provider | Accuracy (1-5) | Completeness (1-5) | Relevance (1-5) | Clarity (1-5) | Consistency (1-5) | Evidence Support (1-5) | Unsupported Claims (1-5) | Weighted Total |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **V1 (Baseline)** | OpenAI | — | — | — | — | — | — | — | — |
| **V1 (Baseline)** | Gemini | — | — | — | — | — | — | — | — |
| **V1 (Baseline)** | Claude | — | — | — | — | — | — | — | — |
| **V2 (Chained)** | OpenAI | — | — | — | — | — | — | — | — |
| **V2 (Chained)** | Gemini | — | — | — | — | — | — | — | — |
| **V2 (Chained)** | Claude | — | — | — | — | — | — | — | — |
| **V3 (Verified)** | OpenAI | — | — | — | — | — | — | — | — |
| **V3 (Verified)** | Gemini | — | — | — | — | — | — | — | — |
| **V3 (Verified)** | Claude | — | — | — | — | — | — | — | — |
