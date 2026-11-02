# PrivacyLens — Prompt Engineering Workspace

**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Problem Statement:** C18 — Terms and Conditions in Plain Language  
**Team:** ladybug

---

## 1. Purpose of This Workspace

Prompt engineering is the core academic and technical contribution of **PrivacyLens**. Rather than relying on a single static prompt hidden inside application code, all prompt templates, structural iterations, and verification strategies are versioned and documented in this directory so they can be systematically evaluated across multiple LLM providers (**OpenAI ChatGPT**, **Google Gemini**, and **Anthropic Claude**).

---

## 2. Planned Prompt Architecture Progression

We will design, implement, and experimentally compare three distinct prompting architectures:

### V1: Baseline Single-Prompt Approach (`versions/baseline-v1.md`)
- **Strategy:** A single direct instruction prompt that asks the model to read the privacy policy and summarize data collection, usage, third-party sharing, user rights, risky/unclear clauses, and missing information in plain language.
- **Role in Study:** Preserves the exact baseline prompt submitted in our Milestone 1 proposal. Serves as the control benchmark against which structured and multi-stage prompts are measured.

### V2: Chained Prompting for Clause Extraction and Plain-Language Explanation (`versions/chained-v2.md`)
- **Strategy:** Decomposes policy analysis into three sequential stages with explicit JSON inputs and outputs:
  1. **Stage 1 (Verbatim Clause Extraction & Taxonomy Tagging):** Extracts verbatim policy clauses categorized by taxonomy and explicitly flags absent categories.
  2. **Stage 2 (Structured Privacy & Clause Analysis):** Maps collected data to purposes, structures third-party sharing and user rights, distinguishes `Explicitly Stated Term` from `Potentially Concerning / Broad Wording`, and records grounded missing topics.
  3. **Stage 3 (Plain-Language Synthesis — Unverified Candidate Output):** Translates the structured analysis into accessible, non-legalistic explanations while retaining strict links to the supporting excerpts from Stage 1. Marks its output as `verificationStatus: "unverified_candidate"` (`verified: false`) without claiming independent verification.
- **Hypothesis:** Separating evidence extraction and technical analysis from plain-language summarization reduces hallucination, improves completeness, and ensures every claim is tied to an original quote.

### V3: Chained Prompting with Independent Verification Stage (`versions/verified-v3.md`)
- **Strategy:** Extends the V2 pipeline with a dedicated **Stage 4 (Independent Accuracy & Grounding Auditor)**:
  1. **Stages 1–3:** Execute the V2 chained extraction, structured analysis, and unverified candidate synthesis pipeline.
  2. **Stage 4 (Independent Verification):** An auditor prompt independently checks every factual claim, every `supportingExcerpt`, and every `missingInformation` explanation against `<UNTRUSTED_POLICY_TEXT>`, removing unsupported claims or unmentioned data categories, enforcing `"Not specified"` on missing information, and enforcing the 4-way distinction between explicitly stated policy terms, potentially concerning/broad wording, unspecified information, and conditional implications (`verificationStatus: "verified_by_stage4"`, `verified: true`).
- **Hypothesis:** Adding an independent verification pass minimizes unsupported claims and improves consistency across models.

> See [`prompt-workflow.md`](./prompt-workflow.md) for the complete **Unified JSON Output Schema** and a step-by-step trace of how a policy clause flows through Stages 1–4.

---

## 3. Evaluation Dimensions

All prompt versions (V1, V2, V3) across all three AI providers will be compared using the rubric in `../evaluation/evaluation-rubric.md` across seven core criteria:

1. **Accuracy** — Factual alignment with the source policy text.
2. **Completeness** — Coverage of all required privacy dimensions and explicit detection of missing disclosures.
3. **Relevance** — Focus on material privacy practices rather than boilerplate filler.
4. **Clarity** — Readability for ordinary internet users without legal training.
5. **Consistency** — Structural and analytical stability across repeated runs and different policy styles.
6. **Evidence Support** — Presence and fidelity of original policy excerpts backing each major finding.
7. **Unsupported Claims (Hallucination Rate)** — Frequency of invented clauses, assumed practices, or ungrounded risk assertions.

---

## 4. Responsible Prompting & Security Guardrails

All future prompt iterations (V2 and V3) must enforce:
- **Source-of-Truth Grounding:** Base findings strictly on the supplied document text.
- **Explicit Missing-Info Reporting:** State clearly when a policy omits details on retention, sharing, or user rights.
- **Prompt Injection Defense:** Treat extracted webpage text strictly as untrusted data delimited from system instructions, ignoring any embedded directives inside webpage content.
- **Non-Legal-Advice Boundary:** Explain why a clause warrants user attention without rendering legal validity judgments.
