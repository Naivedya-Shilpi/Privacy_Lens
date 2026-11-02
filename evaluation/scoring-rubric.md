# PrivacyLens — Phase 4 Detailed Scoring Rubric (10-Metric Evaluation System)

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Status:** Evaluation Rubric Specification (No Live Experimental Results Recorded)

---

## 1. Overview of the 10-Metric Scoring Architecture

To rigorously compare **Prompt V1 (`baseline-v1`)**, **Prompt V2 (`chained-v2`)**, and **Prompt V3 (`verified-v3`)** across both the **580 consensus clause benchmark** (including the **498 held-out English consensus subset**) and **full-policy benchmarks**, PrivacyLens evaluates every run across **10 standardized metrics**.

### Metric Summary & Weighting Table

| Metric ID | Metric Name | Primary Scope | Item Scale | Normalized Scale | Weight in Composite Score |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **M1** | **Clause Identification Accuracy** | Clause & Policy | `0 – 2` | `0.0 – 1.0` (or `0 – 100%`) | 12% |
| **M2** | **Data Collection Identification** | Clause (`GenData`) & Policy | `0 – 2` | `0.0 – 1.0` | 10% |
| **M3** | **Data Usage Identification** | Clause (`GenUse`) & Policy | `0 – 2` | `0.0 – 1.0` | 10% |
| **M4** | **Third-Party Sharing Identification** | Policy & Relevant Clauses | `0 – 2` | `0.0 – 1.0` | 8% |
| **M5** | **User Rights Identification** | Policy & Relevant Clauses | `0 – 2` | `0.0 – 1.0` | 8% |
| **M6** | **Risk and Vague Wording Identification** | Clause (`GenData`/`GenUse`/`NoDist`) & Policy | `0 – 2` | `0.0 – 1.0` | 12% |
| **M7** | **Evidence Grounding** | Clause & Policy | `0 – 2` | `0.0 – 1.0` | 12% |
| **M8** | **Missing-Information Handling** | Clause & Policy | `0 – 2` | `0.0 – 1.0` | 8% |
| **M9** | **Plain-Language Clarity** | Clause & Policy | `0 – 2` | `0.0 – 1.0` | 8% |
| **M10** | **Hallucination Rate** *(Inverse Safety Metric)* | Clause & Policy | Count & `0 – 2` | Rate $\in [0.0, 1.0]$; Integrity $= 1 - \text{Rate}$ | 12% |

> **Isolated-Clause `N/A` Rule (No Penalty for Information Unavailable in Excerpt):**  
> In **isolated-clause experiments** (where the input `{{POLICY_TEXT}}` is a single clause or short excerpt rather than a complete privacy policy):
> - **M8 (Missing-Information Handling)** MUST be marked **`N/A`** because an isolated clause is a fragment of a policy and is insufficient to establish what is omitted across the complete privacy policy.
> - **M4 (Third-Party Sharing Identification)** and **M5 (User Rights Identification)** MUST be marked **`N/A`** whenever the supplied clause excerpt is insufficient to establish the platform's third-party sharing practices (**M4**) or user rights (**M5**).
> - Models are **never penalized** for information unavailable in the supplied excerpt. Any metric marked `N/A` is excluded from the composite score denominator $\sum_{m \in \mathcal{A}_i} w_m$. (If a model *fabricates* third-party sharing or user rights not present in an isolated excerpt, that fabrication is penalized under **M10 Hallucination Rate**.)

---

## 2. Detailed Rubric for Each Metric (Criteria, Formulas & Examples)

---

### M1: Clause Identification Accuracy (`clause_identification_accuracy`)

- **Definition:** Measures whether the prompt output accurately captures and characterizes the core privacy-relevant clause(s) present in the input text without omitting material provisions or misattributing them to the wrong privacy dimension.
- **Scoring Scale (`0 – 2`):**
  - **`0` (Failed / Missed):** Fails to identify the target clause, completely misinterprets its meaning, or maps it to an unrelated category.
  - **`1` (Partial Identification):** Identifies the clause's general topic but omits a material qualifier (e.g., captures the main rule but misses an embedded condition or exception) or captures only one label of a multi-label clause.
  - **`2` (Accurate Identification):** Accurately identifies the clause, preserves all material qualifiers, and maps it to all applicable privacy dimensions (including multi-label categories when a clause belongs to both `GenUse` and `NoDist`).
- **Example:**
  - *Source Clause (`PL-TC-0004`, Baidu AI Cloud, Multi-Label `GenUse` + `NoDist`):* *"We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners, and carry out necessary business operations, such as product operation and service provision..."*
  - *Score `2`:* Identifies that the clause governs both data usage (`GenUse`) and unlinked data-to-purpose scope (`NoDist`), accurately capturing that collected data is used for Baidu's and its partners' products and open-ended business operations.
  - *Score `1`:* Notes that Baidu uses data to improve services, but overlooks the mention of Baidu's related parties/partners or the open-ended *"such as"* catalogue.
  - *Score `0`:* Misclassifies the sentence solely as a user account deletion right or misses it entirely.

---

### M2: Data Collection Identification (`data_collection_identification`)

- **Definition:** Measures accuracy in identifying what personal, device, or behavioral data is collected—and, for `GenData` clauses, recognizing when collected data categories are stated using vague general terms or open-ended catalogues (*"such as"*, *"including but not limited to"*).
- **Scoring Scale (`0 – 2`):**
  - **`0` (Incorrect / Missed):** Misses stated data types, invents unmentioned data types, or fails to recognize vague/open-ended data collection language in a `GenData` test case.
  - **`1` (Incomplete):** Lists some stated data types or notes general data collection, but misses explicit items in the clause or fails to note that the list of collected data is open-ended.
  - **`2` (Complete & Precise):** Accurately identifies all stated data categories/types in the input and explicitly notes any broad or open-ended collection phrasing (`GenData`).
- **Example:**
  - *Source Clause (`Dropbox`, `DataExamp1`):* *"We collect information related to how you use the Services, including actions you take in your account (like sharing, editing, viewing, creating and moving files or folders)."*
  - *Score `2`:* Identifies collection of service-usage and account-action metadata (sharing, editing, viewing, creating, moving files/folders) and notes that *"including"* introduces a non-exhaustive list of tracked actions.
  - *Score `1`:* Mentions that Dropbox collects file-editing activity, but omits the broader *"information related to how you use the Services"* framing.
  - *Score `0`:* Claims Dropbox collects biometric voiceprints (not in text) or states no data collection is mentioned.

---

### M3: Data Usage Identification (`data_usage_identification`)

- **Definition:** Measures accuracy in identifying the stated purposes and ways in which collected data is processed—and, for `GenUse` and `NoDist` clauses, recognizing open-ended usage catalogues (`GenUse`) or failure to specify which data is used for which purpose (`NoDist`).
- **Scoring Scale (`0 – 2`):**
  - **`0` (Incorrect / Missed):** Fails to identify stated usage purposes or fabricates purposes not present in the source text.
  - **`1` (Incomplete):** Identifies primary stated purposes (e.g., *"provide and improve services"*) but misses secondary purposes in the same clause (e.g., *"developing new products"*, *"research"*) or fails to note the lack of data-to-purpose linkage in a `NoDist` clause.
  - **`2` (Complete & Precise):** Accurately captures all stated usage purposes and explicitly identifies vague usage phrasing (`GenUse`) and/or unlinked data-purpose bundling (`NoDist`) where present.
- **Example:**
  - *Source Clause (`Dropbox`, `GenUse2` / `NoDist2`):* *"We collect and use the personal data described above in order to provide you with the Services in a reliable and secure manner."*
  - *Score `2`:* Identifies the stated purpose (providing Services reliably and securely) and notes that *"the personal data described above"* bundles all previously listed data categories together without specifying which data items serve reliability vs. security (`NoDist`).
  - *Score `1`:* States that data is used to provide reliable and secure services, without noting the blanket reference to all data described above.
  - *Score `0`:* Claims the data is used for third-party targeted advertising.

---

### M4: Third-Party Sharing Identification (`third_party_sharing_identification`)

- **Definition:** Measures accuracy in identifying whether and how data is shared with third parties (recipient categories, shared data types, and stated sharing purposes) when the input text establishes third-party sharing disclosures.
- **Applicability (`N/A` Rule for Isolated Clauses):**
  - Marked **`N/A`** in isolated-clause runs whenever the supplied excerpt does not contain sufficient information to establish third-party data-sharing disclosures across the policy. (If the model invents third-party recipients on an `N/A` clause, record the fabrication in **M10 Hallucination Rate**.)
- **Scoring Scale (`0 – 2`, when applicable):**
  - **`0` (Incorrect / Missed):** Misses explicit third-party sharing or affiliate transfers stated in the text, or contradicts the stated disclosure.
  - **`1` (Partial):** Identifies that data is shared with third parties (e.g., *"suppliers or partners"*), but omits the stated conditions, shared data scope, or purpose of sharing.
  - **`2` (Complete & Grounded):** Accurately identifies all stated third-party recipients, shared data, and sharing purposes (or, in full-policy evaluation mode, accurately reports `"Not specified"` when the complete policy omits third-party sharing).
- **Example:**
  - *Source Clause (`Baidu AI Cloud`, `GenUse3`):* *"We share personal data with suppliers or partners who represent us in accordance with the instructions of Baidu AI Cloud to provide services..."*
  - *Score `2`:* Identifies recipients (`suppliers or partners who represent us`), shared data (`personal data`), and stated purpose/condition (`in accordance with Baidu AI Cloud instructions to provide services`).
  - *Score `1`:* Mentions data is shared with partners, omitting that they act under Baidu's instructions to provide services.
  - *Score `0`:* States Baidu never shares personal data with third parties.

---

### M5: User Rights Identification (`user_rights_identification`)

- **Definition:** Measures accuracy in identifying user rights and choices (access, deletion, correction, opt-out), how to exercise them, and any stated exceptions or limitations when the input text addresses user rights.
- **Applicability (`N/A` Rule for Isolated Clauses):**
  - Marked **`N/A`** in isolated-clause runs whenever the supplied excerpt does not address user rights (since all 580 consensus clauses target `GenData`, `GenUse`, and `NoDist`, **M5** is `N/A` on isolated clauses that lack user-rights provisions). Models are never penalized when user rights are unavailable in the supplied excerpt.
- **Scoring Scale (`0 – 2`, when applicable):**
  - **`0` (Incorrect / Missed):** Misses explicitly stated user rights/exceptions in the input text.
  - **`1` (Partial):** Identifies a stated user right (e.g., account deletion) but omits how to exercise it or misses a stated limitation/exception in the same passage.
  - **`2` (Complete & Grounded):** Accurately captures the stated right, exercise mechanism, and any stated limitations (or, in full-policy evaluation mode, accurately reports `"Not specified"` when the complete policy omits user rights).
- **Example:**
  - *Source Clause (`SYNTH-001`, Section 4):* *"You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example. However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion."*
  - *Score `2`:* Captures both rights (access profile data copy, delete account), the email mechanism (`privacy-requests@novanote.example`), and the explicit ML training-set retention exception.
  - *Score `1`:* States users can delete their account by emailing NovaNote, but omits the exception that notes in ML training sets cannot be removed.
  - *Score `0`:* Claims users can delete all data including AI training copies via an account settings toggle.

---

### M6: Risk and Vague Wording Identification (`risk_and_vague_wording_identification`)

- **Definition:** Measures how accurately the prompt identifies vague, open-ended, or high-impact clauses (`GenData`, `GenUse`, `NoDist`, or restrictive waivers) **and** adheres to the epistemic distinction between **Explicitly Stated Terms**, **Potentially Concerning / Broad Wording**, and **Conditional Implications** (never presenting speculative interpretations as confirmed harmful facts or giving legal advice).
- **Scoring Scale (`0 – 2`):**
  - **`0` (Missed or Misrepresented as Confirmed Harm / Legal Advice):** Fails to flag vague/concerning wording in a benchmark clause, OR exaggerates broad wording into an accusation of confirmed illegal/harmful conduct, OR offers legal advice.
  - **`1` (Flagged but Uncalibrated):** Flags the clause as vague or risky, but provides a generic explanation that fails to explain *why* the wording is broad (e.g., misses open-catalogue terms like *"such as"* / *"may"*) or blurs stated terms with speculative implications.
  - **`2` (Accurately Flagged & Epistemically Calibrated):** Correctly classifies the clause (`Potentially Concerning / Broad Wording` vs. `Explicitly Stated Term`), explains specifically what makes the phrasing vague, broad (`GenData`/`GenUse`), or unlinked (`NoDist`), and frames potential implications conditionally without claiming confirmed harm.
- **Example:**
  - *Source Clause (`Oktawave`, Tagger 2 `GenUse1` in `OVH`):* *"The above-mentioned data may be processed for other purposes than contract management and retained for the period necessary to fulfill these other purposes."*
  - *Score `2`:* Flags as `Potentially Concerning / Broad Wording` (`GenUse` + `NoDist`), explaining that *"may be processed for other purposes"* and *"period necessary to fulfill these other purposes"* are open-ended phrases that do not specify what those additional purposes or retention periods are, granting broad flexibility without confirming that misuse has occurred.
  - *Score `1`:* Labels the clause "Risky" and says "They keep your data forever for unknown reasons" (overstates permissive wording as confirmed fact).
  - *Score `0`:* Reports the clause as a clear, tightly limited retention schedule.

---

### M7: Evidence Grounding (`evidence_grounding`)

- **Definition:** Measures the **correctness, verbatim fidelity, and relevance of cited supporting evidence and quotations** (`supportingExcerpt`)—specifically whether the quotations/citations supplied by the model exist in the input policy text and actually substantiate the analytical point with which they are paired.
- **Orthogonal Distinction Between M7 (Evidence Grounding) and M10 (Hallucination Rate):**
  - **M7 evaluates the *citations and quotations*:** Did the model supply accurate, verbatim quotes from the policy that match the topic of the finding?
  - **M10 evaluates the *factual claims in the generated explanation*:** What proportion of the factual statements generated by the model are unsupported by the source policy?
  - *Why they are independent:* A model can score **`2` on M7** (pasting an exact, verbatim quote from the policy in `supportingExcerpt`) while scoring **`1` or `0` on M10** (adding an unsubstantiated claim in `plainExplanation` that goes beyond what the quote says). Conversely, Prompt V1 can score **`1` on M7** (paraphrasing the policy without supplying verbatim quotation marks) while scoring **`2` on M10** ($\text{HR} = 0.00$, zero unsupported factual claims).
- **Scoring Scale (`0 – 2`):**
  - **`0` (Ungrounded / Fabricated / Irrelevant Quote):** Provides no supporting evidence/citation, cites a fabricated or substantially altered quote not found in the source text, or cites a quote that is irrelevant to the paired finding.
  - **`1` (Paraphrased or Partially Quoted Evidence):** Grounds findings via recognizable paraphrase or short 2–3 word fragments rather than full verbatim clause excerpts (typical of V1 native prose outputs), or provides verbatim excerpts for some findings while omitting them for others.
  - **`2` (Strictly Verbatim & Substantiating Quotations):** Every finding is paired with an exact, word-for-word `supportingExcerpt` from the input text that directly substantiates the paired finding.
- **Fairness Note for Prompt V1:** Because `baseline-v1.md` does not explicitly request verbatim quotes, V1's native output is scored honestly on **M7** (`1` if accurately paraphrased from the text without full verbatim quotes; `2` if it includes verbatim quotes; `0` if ungrounded), while we report both **Composite Score A (Full Score including M7)** and **Composite Score B (Substantive Score excluding M7)**.

---

### M8: Missing-Information Handling (`missing_information_handling`)

- **Definition:** When the input text is sufficient to evaluate policy-wide disclosures (such as in **Full-Policy Evaluation Mode** or a multi-section excerpt designed to test omissions), measures whether the prompt explicitly identifies omitted privacy dimensions (`"Not specified"`) and grounds its explanation strictly in the source text without introducing unmentioned data categories.
- **Applicability (`N/A` Rule for Isolated Clauses):**
  - Marked **`N/A`** in **isolated-clause experiments** whenever the supplied excerpt is a single clause or short fragment that is insufficient to establish whether a topic (such as data retention, third-party sharing, or user rights) is missing across the complete privacy policy. Models are **never penalized** for information unavailable in an isolated excerpt.
  - *(Note: Even when M8 is marked `N/A` on an isolated clause, if a model's `missingInformation` field invents unmentioned data categories—such as claiming the excerpt fails to mention "biometric voiceprints"—that invented detail is counted as an unsupported claim under **M10 Hallucination Rate**.)*
- **Scoring Scale (`0 – 2`, when applicable in Full-Policy / Multi-Section Mode):**
  - **`0` (Ignored or Ungrounded):** Fails to identify omitted privacy dimensions in a full policy, guesses/assumes standard industry practices for missing topics, or introduces unmentioned data categories inside the missing-information explanation.
  - **`1` (Partial / Implicit):** Notes some omitted categories in a full policy but leaves others blank/ambiguous without explicit `"Not specified"` markers.
  - **`2` (Explicit `"Not specified"` & Strictly Grounded):** Explicitly marks all omitted privacy dimensions across the policy as `"Not specified"` and explains what is missing strictly in terms of the core privacy taxonomy or data items explicitly present in the source policy.
- **Example (Full-Policy Mode on `SYNTH-001`):**
  - *Input Text:* Complete `SYNTH-001` policy (which specifies data collection, usage, third-party sharing, and account deletion rights, but omits standard data retention periods).
  - *Score `2`:* Explicitly marks `dataRetentionStatus: "Not specified"`, explaining that while the policy states notes in aggregated ML training sets cannot be removed after deletion, it does not specify how long active account profile data, usage telemetry, keystroke timing metadata, or audio recordings are stored.
  - *Score `0`:* Fails to note that data retention duration is missing, or claims a 30-day retention period not found in `SYNTH-001`.

---

### M9: Plain-Language Clarity (`plain_language_clarity`)

- **Definition:** Measures how clearly and accessibly the explanation is written for an ordinary internet user without legal training, avoiding unexplained legal/technical jargon while preserving factual precision.
- **Scoring Scale (`0 – 2`):**
  - **`0` (Opaque / Copy-Pasted Legalese):** Repeats dense legal boilerplate verbatim in the explanation field without simplifying, or produces disorganized, confusing text.
  - **`1` (Moderately Clear):** Understandable overall, but retains unexplained legal/technical terms (e.g., *"legitimate business interests"*, *"data controller"*, *"indemnification"*, *"telemetry"*) or overly long sentences.
  - **`2` (Clear, Accessible & Structured):** Translates legal phrasing into crisp, everyday language with clear bullet points/sections, explaining any necessary technical concept in simple terms without distorting the policy's meaning.

---

### M10: Hallucination Rate (`hallucination_rate` & `hallucination_control_score`)

- **Definition:** Measures the **proportion of unsupported factual claims in the generated response**—including invented policy clauses, fabricated data types, unmentioned third parties, or speculative interpretations presented as confirmed facts across all generated statements.
- **Quantitative Calculation (Per Output):**
  Let $C_{\text{total}} \ge 1$ be the total number of distinct factual assertions (atomic claims) made in the generated response, and let $C_{\text{unsupported}} \ge 0$ be the number of factual assertions that are not supported by `<UNTRUSTED_POLICY_TEXT>` (including invented facts, unmentioned data categories introduced in `missingInformation`, or speculative implications stated as confirmed facts).
  $$\text{Hallucination Rate (HR)} = \frac{C_{\text{unsupported}}}{C_{\text{total}}} \in [0.00, 1.00]$$
- **Mutually Exclusive & Unambiguous Ordinal Scoring Rules (`0 – 2`):**
  Every pair $(C_{\text{unsupported}}, \text{HR})$ maps to **one and only one** ordinal score:
  - **`2` (Zero Hallucinations):**
    $$C_{\text{unsupported}} = 0 \quad (\text{i.e., } \text{HR} = 0.00)$$
    *Criteria:* Every factual claim across all generated fields is 100% grounded in the provided policy text.
  - **`1` (Isolated Minor Drift with Low Hallucination Ratio):**
    $$C_{\text{unsupported}} = 1 \quad \text{AND} \quad \text{HR} \le 0.20 \quad (\text{i.e., } C_{\text{total}} \ge 5)$$
    *Criteria:* Exactly 1 unsupported factual claim occurs within a response containing at least 5 total factual claims, so the single unsupported detail represents at most 20% of the response's claims.
  - **`0` (Substantial Hallucination — Multiple Unsupported Claims OR Single Claim with High Hallucination Ratio):**
    $$C_{\text{unsupported}} \ge 2 \quad \text{OR} \quad \left(C_{\text{unsupported}} = 1 \text{ AND } \text{HR} > 0.20\right)$$
    *Criteria:* Either the response contains **2 or more** unsupported factual claims ($C_{\text{unsupported}} \ge 2$), **OR** the response contains **1 unsupported factual claim in a short output ($C_{\text{total}} \le 4$) where $\text{HR} > 0.20$** (meaning more than 20% of the generated claims are unsupported).

| $C_{\text{unsupported}}$ | $\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$ | M10 Ordinal Score (`0 – 2`) | Classification |
| :---: | :---: | :---: | :--- |
| $0$ | $\text{HR} = 0.00$ | **`2`** | Zero Hallucinations |
| $1$ | $0.00 < \text{HR} \le 0.20$ ($C_{\text{total}} \ge 5$) | **`1`** | Isolated Minor Drift (Low Ratio) |
| $1$ | $\text{HR} > 0.20$ ($C_{\text{total}} \le 4$) | **`0`** | High-Ratio Single Hallucination |
| $\ge 2$ | Any $\text{HR} > 0.00$ | **`0`** | Multiple Unsupported Claims |

---

## 3. Composite Score Aggregation Formula

For any evaluated test case $i$, let $S_{i,m} \in \{0, 1, 2\}$ be the ordinal score on applicable metric $m \in \{\text{M1}, \dots, \text{M10}\}$, and $w_m$ be its weight from Section 1. The normalized weighted composite score $\text{Score}_i \in [0, 100]$ is:

$$\text{Score}_i = 100 \times \frac{\sum_{m \in \mathcal{A}_i} w_m \cdot \left(\frac{S_{i,m}}{2}\right)}{\sum_{m \in \mathcal{A}_i} w_m}$$

where $\mathcal{A}_i$ is the set of metrics applicable to test case $i$. Alongside the **Full 10-Metric Composite Score**, we also compute the **9-Metric Substantive Score** (excluding M7 verbatim quote formatting) when comparing Prompt V1's native prose output against Prompt V2 and Prompt V3.
