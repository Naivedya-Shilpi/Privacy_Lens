# PrivacyLens — System Architecture

## 1. High-Level Architecture

PrivacyLens follows a clean, modular three-tier separation between the **Chrome Extension Frontend**, the **Node.js/Express Backend API**, and the **Prompt Engineering & Multi-Provider AI Layer**.

```
+-----------------------------------------------------------------------+
|                   Chrome Browser Extension (Manifest V3)              |
|                                                                       |
|  +-----------------------+     Explicit User Click    +-------------+ |
|  | Popup UI (HTML/CSS/JS)| -------------------------> | extractor.js| |
|  +-----------+-----------+   (activeTab + scripting)  +-------------+ |
|              |                                                        |
+--------------+--------------------------------------------------------+
               | HTTP / JSON (localhost:3000)
               | (No API keys stored in browser extension)
               v
+-----------------------------------------------------------------------+
|                     Express Backend Server (Node.js)                  |
|                                                                       |
|  +-----------------------+   +-------------------------------------+  |
|  | Routes (/api/health,  |   | Middleware (Helmet, CORS, JSON,     |  |
|  | future /api/analyze)  |   | Centralized Error Handler)          |  |
|  +-----------+-----------+   +-------------------------------------+  |
|              |                                                        |
|              v                                                        |
|  +-----------------------------------------------------------------+  |
|  |         Provider-Independent AI Service Layer                   |  |
|  |                 (BaseAIProvider Interface)                      |  |
|  +-----------------+--------------------+--------------------------+  |
|                    |                    |                             |
|        +-----------+----+     +---------+---------+    +-----------+  |
|        v                |     v                   |    v           |  |
|  +---------------+      |  +---------------+      |  +-----------+ |  |
|  |OpenAIProvider |      |  |GeminiProvider |      |  |ClaudeProv.| |  |
|  | (openai SDK)  |      |  |(@google/genai)|      |  |(@anthropic| |  |
|  +---------------+      |  +---------------+      |  +-----------+ |  |
+-----------------------------------------------------------------------+
```

---

## 2. Component Responsibilities

### 2.1 Browser Extension (`extension/`)
- **Manifest V3 (`manifest.json`):** Requests minimal permissions (`activeTab`, `scripting`) and avoids `<all_urls>` host permissions. Webpage access occurs solely after explicit user invocation.
- **Popup Interface (`popup/`):** Built with semantic HTML, modular CSS (navy/white/blue palette), and Vanilla JavaScript. Displays backend connection status, allows testing connectivity (`GET /api/health`), and triggers user-invoked tab inspection.
- **Content Extractor (`content/extractor.js`):** Injected on-demand via `chrome.scripting.executeScript`. Currently a verified placeholder returning basic page metadata; will be expanded in Phase 2 to extract and sanitize policy text.
- **Background Service Worker (`background/service-worker.js`):** Handles extension lifecycle events and message routing.

### 2.2 Backend Server (`server/`)
- **Configuration (`src/config/env.js`):** Loads `.env` via `dotenv` and validates environment variables using `zod`. Keeps API keys strictly isolated on the server.
- **Express Application (`src/app.js` & `src/server.js`):** Configures `helmet` security headers, origin-restricted `cors` for local development and Chrome extension origins, JSON body parsing, and graceful shutdown.
- **Routes (`src/routes/health.routes.js`):** Implements `GET /api/health` returning server status, timestamp, and non-sensitive provider readiness booleans.
- **Provider-Independent AI Layer (`src/services/ai/`):**
  - `provider-interface.js`: Abstract base class (`BaseAIProvider`) defining a uniform contract across LLMs.
  - `openai.provider.js`: Adapter for OpenAI (`openai` SDK).
  - `gemini.provider.js`: Adapter for Google Gemini (`@google/genai` SDK).
  - `claude.provider.js`: Adapter for Anthropic Claude (`@anthropic-ai/sdk`).

### 2.3 Prompt Engineering & Evaluation Workspaces (`prompts/`, `evaluation/`, `datasets/`)
- **`prompts/`:** Houses version-controlled prompt templates starting with `versions/baseline-v1.md` and documentation for upcoming V2 (Chained) and V3 (Chained + Verification) architectures.
- **`evaluation/`:** Contains the 7-dimension evaluation rubric (`evaluation-rubric.md`) and deterministic test cases (`test-cases/synthetic-policy.json`).
- **`datasets/`:** Documents guidelines for external policy benchmarks without bundling heavy or unverified datasets.

---

## 3. Security & Threat Mitigation Design

1. **Zero Client-Side Secrets:** The Chrome extension never stores or transmits LLM API keys. All model requests will be proxied through the local backend server.
2. **Least-Privilege Extension Permissions:** By relying on `activeTab` and `scripting` instead of `<all_urls>`, PrivacyLens cannot silently read browsing activity in the background.
3. **Prompt Injection Isolation (Phase 2/3 Design):** Webpage text sent to `/api/analyze` in future phases will be wrapped in explicit data delimiters and accompanied by system instructions directing the model to ignore any instructions found inside the policy text.
4. **Transient Processing:** The backend does not use a database or persist extracted webpage content to disk or logs.
