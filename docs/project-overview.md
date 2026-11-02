# PrivacyLens — Project Overview

## 1. Project Identity

- **Project Name:** PrivacyLens
- **Team Name:** ladybug
- **Team Size:** 4 Members
- **Problem Statement:** C18 — Terms and Conditions in Plain Language
- **Course:** Prompt Engineering (SCSE4041), Bennett University

---

## 2. Problem Statement & Motivation

Internet users routinely accept lengthy, complex privacy policies and terms of service without reading or understanding them. Dense legal terminology obscures critical details regarding:
- What personal and behavioral data is collected.
- How collected data is processed or monetized.
- Whether personal information is shared with or sold to third parties.
- How long data is retained and what rights users have (access, deletion, opt-out).
- Clauses that introduce unusual risks, broad waivers, or unilateral policy changes.

**PrivacyLens** addresses Problem Statement C18 by providing a browser extension companion that analyzes the privacy policy or terms of a webpage upon explicit user request and translates complex clauses into structured, plain-language insights backed by verbatim excerpts from the original policy.

---

## 3. Core Outputs of PrivacyLens (Target System)

When full policy analysis is connected in upcoming development phases, PrivacyLens will generate:
1. **Simple, Understandable Summary** — A concise executive overview written for everyday internet users.
2. **Data Collection Breakdown** — Clear listing of personal, device, and behavioral data collected.
3. **Data Usage Explanations** — Plain-language explanation of why data is collected and how it is used.
4. **Third-Party Data Sharing** — Transparency into advertising partners, analytics providers, affiliates, or data brokers.
5. **Data Retention & User Rights** — Information on storage duration, account deletion, data export, and opt-out controls.
6. **Potentially Risky or Unclear Clauses** — Identification of clauses requiring user attention, accompanied by a clear explanation of *why* each clause is notable.
7. **Supporting Policy Excerpts** — Verbatim quotes from the original policy supporting every key finding, alongside explicit reporting of any missing information.

---

## 4. Prompt Engineering Research Contribution

Rather than building a wrapper around a single generic prompt, PrivacyLens investigates how structured prompt engineering improves reliability, evidence grounding, and hallucination resistance across three major LLM providers (**OpenAI ChatGPT**, **Google Gemini**, and **Anthropic Claude**):

- **V1 (Baseline Single-Prompt):** Evaluates the original Milestone 1 single-pass instruction prompt.
- **V2 (Chained Prompting):** Separates verbatim clause extraction/classification from plain-language explanation.
- **V3 (Chained Prompting + Independent Verification):** Adds an independent verification stage that audits generated claims and excerpts against the source document to eliminate unsupported claims.

---

## 5. Security and Responsible AI Principles

PrivacyLens is governed by ten non-negotiable Responsible AI and security principles across all development phases:

1. **The Original Policy Is the Source of Truth:** All explanations must derive strictly from the provided document text.
2. **Zero Fabricated Clauses:** The AI must never invent clauses or assume standard industry practices when the text is silent.
3. **Evidence-Backed Findings:** Every important finding must be supported by an original policy excerpt.
4. **Explicit Missing-Information Reporting:** When a policy fails to mention key topics (such as data retention or deletion rights), the system must explicitly state that the information is missing.
5. **Justified Risk Classifications:** Risk indicators must explain clearly *why* a clause deserves user attention rather than assigning arbitrary alarmist labels.
6. **Not Legal Advice:** PrivacyLens is an informational transparency tool. It must never pretend to be a legal adviser or declare whether a policy is legally compliant or safe to accept.
7. **Untrusted Input Handling:** Extracted webpage text must be treated strictly as untrusted data, never as executable instructions to the AI model.
8. **Prompt Injection Defense:** Prompt templates and backend pipelines must isolate policy text using strict structural delimiters and system guardrails to defend against adversarial prompt injection embedded in webpages.
9. **Data Minimization (No Unnecessary Storage):** Extracted policy text is processed transiently in memory for analysis and must not be unnecessarily persisted in databases.
10. **Privacy-Safe Logging:** Server logs must avoid logging sensitive user data, secret API keys, or full policy contents.
