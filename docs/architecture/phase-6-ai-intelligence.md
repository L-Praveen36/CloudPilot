# CloudPilot Phase 6 Architecture: AI Intelligence & Agent Layer

## 1. System Overview & Core Philosophy

The CloudPilot Phase 6 AI Intelligence & Agent Layer introduces autonomous assistive intelligence to the CloudPilot platform while adhering strictly to the fundamental invariant:

> **"AI proposes — Deterministic systems validate and control execution."**

LLMs are treated as non-authoritative advisory systems. No LLM output may directly execute shell commands, mount Docker sockets, access cloud infrastructure, modify repository files, or deploy containers without passing strict deterministic security validators, schema guards, and human approval gates.

```text
                               +---------------------------------------------+
                               |              CloudPilot Web UI              |
                               |    (Interactive Explanations, Proposals,     |
                               |     Diagnosis Feeds, Human Approval Gates)  |
                               +----------------------+----------------------+
                                                      |
                                                      v
                               +---------------------------------------------+
                               |            AiController / AiService          |
                               |  - Authentication Guard (req.user)          |
                               |  - Multi-tenant Project Ownership Validation|
                               +----------------------+----------------------+
                                                      |
                               +----------------------+----------------------+
                               |                                             |
                               v                                             v
        +----------------------------------+        +----------------------------------+
        |   AiContextSanitizerService      |        |       AiProviderFactory          |
        |  - Redacts GitHub / Bearer tokens|        |  - MockAiProvider (Offline/Heur.)|
        |  - Redacts URI passwords & keys  |        |  - OpenAiCompatibleProvider (LLM)|
        |  - Defends against prompt inj.   |        +-----------------+----------------+
        |  - Safety bounds for log context |                          |
        +----------------------------------+                          v
                               |                    +----------------------------------+
                               |                    |           AiProvider             |
                               +------------------->|   chat() / generateCompletion()  |
                                                    +-----------------+----------------+
                                                                      |
                                                                      v
                                                    +----------------------------------+
                                                    |  Deterministic Security Validator|
                                                    |  - Multi-stage Dockerfile Guard  |
                                                    |  - Disallows privileged/sockets  |
                                                    |  - Validates AST / ports / images|
                                                    +-----------------+----------------+
                                                                      |
                                                                      v
                                                    +----------------------------------+
                                                    | Human-in-the-Loop Lifecycle / DB |
                                                    |  - Status: PROPOSED -> APPROVED  |
                                                    |  - Audit in PostgreSQL Schema    |
                                                    +-----------------+----------------+
```

---

## 2. Core Capabilities

### 2.1 Provider-Independent AI Architecture
- **`AiProvider` Interface**: Standard contract for text generation and structured JSON chat completions.
- **`MockAiProvider`**: Deterministic, zero-credential intelligent inference engine using heuristics and codebase analysis. Enables full offline functionality, unit testing, and CI/CD pipelines without API keys.
- **`OpenAiCompatibleProvider`**: Robust HTTP client for any OpenAI-compatible API (OpenAI, Ollama, vLLM, OpenRouter) featuring configurable timeouts, abort controllers, and automated JSON recovery.
- **`AiProviderFactory`**: Dynamically switches providers based on configuration (`AI_PROVIDER_TYPE`).

### 2.2 Context Sanitization & Security Defenses
Before any user input, repository context, or error log reaches an AI model, `AiContextSanitizerService` applies rigorous multi-stage sanitization:
1. **Secret & Credential Redaction**:
   - GitHub OAuth tokens (`ghp_`, `gho_`, `github_pat_`, etc.) -> `[REDACTED_GITHUB_TOKEN]`
   - Authorization Bearer tokens -> `Bearer [REDACTED_BEARER_TOKEN]`
   - Connection URIs (`postgres://user:pass@host:5432/db`) -> `postgres://user:[REDACTED_PASSWORD]@host:5432/db`
   - Inline credentials (`password=...`, `apiKey=...`, `secret=...`) -> `[REDACTED_SECRET]`
   - AWS access keys (`AKIA...`) -> `[REDACTED_AWS_KEY]`
   - Private keys (`-----BEGIN PRIVATE KEY-----`) -> `[REDACTED_PRIVATE_KEY]`
   - Local filesystem workspace paths (`/tmp/cp-src-...`, `C:\Users\...`) -> `[WORKSPACE_ROOT]/...`
2. **Prompt Injection Mitigation**:
   - Neutralizes instruction override attempts (e.g. `ignore previous instructions`, `system prompt:`) with `[INSTRUCTION_OVERRIDE_ATTEMPT_FILTERED]`.
3. **Context Length Bounding**:
   - Safely truncates oversized build logs (max 8,000 chars) and prompts (max 4,000 chars) to prevent context exhaustion and token exploitation.

### 2.3 AI Repository Understanding
- Consumes authoritative deterministic facts from Phase 3.2 (`RepositoryAnalyzerService`), Phase 3.3 (`ApplicationStructureService`), and Phase 3.4 (`DeploymentReadinessService`).
- Synthesizes clear architectural overviews, primary roles, entry point explanations, and recommended deployment strategies.
- Persists results to the `ai_analyses` table in PostgreSQL.

### 2.4 AI Deployment Configuration Generator
- Generates optimized multi-stage Dockerfiles tailored to detected frameworks and package managers.
- Passes proposed configurations through **deterministic security validators** (`DockerExecutionService` AST validation and Phase 6 security rules):
  - Base image verification (official verified images).
  - Explicit port alignment with detected application listening ports.
  - Rejection of privileged mode, root execution where disallowed, Docker socket mounts (`/var/run/docker.sock`), and insecure scripts (`curl | sh`).

### 2.5 AI Failure & Incident Diagnosis
- **Build Failure Diagnosis**: Analyzes build and compile logs, differentiating between verifiable **FACT** (e.g., specific missing module line in log) and logical **INFERENCE** (e.g., dependency missing from `package.json`).
- **Runtime Incident Diagnosis**: Correlates Phase 5 telemetry (CPU, memory, uptime, container status, health probe failures, restart counts) to diagnose out-of-memory crashes, crash loops, and connection timeouts.
- Persisted to the `ai_diagnoses` table.

### 2.6 Human-in-the-Loop AI Repair Suggestions
- AI generates structured repair proposals containing:
  - `title`, `problem`, `likelyCause`, `risk` (`LOW` | `MEDIUM` | `HIGH`).
  - Proposed changes (command to run, diff preview, affected file).
- Strict human approval state machine:
  - Lifecycle: `PROPOSED` -> `APPROVED` or `REJECTED`.
  - Stored in `ai_repair_suggestions` table with timestamps and user associations.
  - No autonomous changes are ever applied without explicit user approval.

### 2.7 Bounded AI Agent with Controlled Tools
- Implements an iterative reasoning agent bounded to a maximum of **5 iterations** and **10 tool calls**.
- Operates exclusively with **8 authenticated, read-only CloudPilot server tools**:
  1. `inspectRepository`
  2. `getRepositoryAnalysis`
  3. `getApplicationStructure`
  4. `getDeploymentReadiness`
  5. `getDeployment`
  6. `getDeploymentLogs`
  7. `getDeploymentEvents`
  8. `getDeploymentMetrics`
- Audits full thought trajectories and tool execution steps in the `ai_agent_interactions` table.

---

## 3. Database Schema (PostgreSQL via Prisma)

```prisma
model AiAnalysis {
  id               String   @id @default(uuid())
  projectId        String
  confidence       String   // HIGH, MEDIUM, LOW
  summary          String   @db.Text
  architecture     Json
  deployment       Json
  buildAndRun      Json
  recommendations  Json
  modelUsed        String
  promptTokens     Int?
  completionTokens Int?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("ai_analyses")
}

model AiDiagnosis {
  id               String   @id @default(uuid())
  deploymentId     String
  category         String   // BUILD, RUNTIME, INCIDENT, CONFIG
  problem          String   @db.Text
  likelyCause      String   @db.Text
  confidence       String   // HIGH, MEDIUM, LOW
  evidence         Json     // Array of { type: FACT | INFERENCE, source, content }
  recommendation   String   @db.Text
  modelUsed        String
  createdAt        DateTime @default(now())

  deployment Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  @@map("ai_diagnoses")
}

model AiRepairSuggestion {
  id             String   @id @default(uuid())
  deploymentId   String?
  projectId      String
  title          String
  problem        String   @db.Text
  likelyCause    String   @db.Text
  risk           String   // LOW, MEDIUM, HIGH
  status         String   @default("PROPOSED") // PROPOSED, APPROVED, REJECTED, APPLIED
  proposedChange Json     // { type, description, file?, diffPreview?, command? }
  appliedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("ai_repair_suggestions")
}

model AiAgentInteraction {
  id               String   @id @default(uuid())
  projectId        String
  prompt           String   @db.Text
  answer           String   @db.Text
  confidence       String   // HIGH, MEDIUM, LOW
  toolsUsed        String[]
  steps            Json     // Array of { step, thought, toolCall, toolResult }
  modelUsed        String
  promptTokens     Int?
  completionTokens Int?
  createdAt        DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("ai_agent_interactions")
}
```

---

## 4. API Endpoints

All endpoints are strictly authenticated and validate multi-tenant project ownership against `req.user.id`:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/projects/:id/ai/understand` | Generate / retrieve AI Repository Understanding |
| `POST` | `/projects/:id/ai/deployment-proposal` | Propose multi-stage Dockerfile configuration |
| `POST` | `/projects/:id/deployments/:deploymentId/ai/diagnose-build` | Diagnose build / compile failure |
| `POST` | `/projects/:id/deployments/:deploymentId/ai/diagnose-incident` | Diagnose runtime incident & telemetry |
| `POST` | `/projects/:id/deployments/:deploymentId/ai/repair-suggestions` | Generate structured repair suggestions |
| `POST` | `/projects/:id/ai/repair-suggestions/:suggestionId/approve` | Approve repair suggestion (Human-in-the-loop) |
| `POST` | `/projects/:id/ai/repair-suggestions/:suggestionId/reject` | Reject repair suggestion (Human-in-the-loop) |
| `POST` | `/projects/:id/ai/agent` | Execute bounded AI Agent inquiry with read-only tools |
| `GET`  | `/projects/:id/ai/history` | Retrieve AI analysis and repair history |

---

## 5. Frontend User Experience

Integrated into `apps/web/app/projects/[id]/page.tsx` via rich dashboard controls:
- **Explain Project**: One-click architectural summary with role identification and confidence rating.
- **Generate Config Proposal**: Visual preview of generated Dockerfile with deterministic security pass/fail indicators.
- **Diagnose Deployment**: Instant root-cause breakdown of build/runtime failures with categorized FACT and INFERENCE evidence tags.
- **Repair Advisor**: Interactive repair cards with diff previews and explicit **Approve Fix** / **Reject** buttons.
- **Controlled AI Agent Terminal**: Interactive query box displaying the agent's step-by-step reasoning trajectory and the verified read-only tools invoked.
