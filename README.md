# CloudPilot 🚀

> **AI-Powered Cloud Deployment, Repository Intelligence & Observability Platform**

CloudPilot is an enterprise-grade platform designed for automated containerization, intelligent repository analysis, multi-environment CI/CD deployment pipelines, autonomous observability, and guarded AI-assisted diagnostics.

---

## Architecture & Roadmap Status

- **Phase 1**: Project Foundation (NPM Workspaces, Next.js 15, NestJS 11, Prisma ORM, PostgreSQL 16, Redis 7, Docker Compose)
- **Phase 2.1**: GitHub OAuth Authentication (AES-256-GCM encrypted token storage, CSRF-protected state, server-side HTTP-only sessions, protected dashboard)
- **Phase 2.2**: GitHub Repository API Integration (Backend repository listing, repository detail, branch listing, pagination, rate-limit safety, 10s request timeouts)
- **Phase 2.3**: Product UI: Repository Dashboard & Connect Flow (Responsive card grid, instant search filter, branch explorer, clone URL snippets, Connect confirmation modal)
- **Phase 2.4**: Project Persistence & Repository Connection (PostgreSQL `Project` model, server-side GitHub repository verification, duplicate prevention, cross-user isolation, Project details and management UI)
- **Phase 3.1**: Repository Source Acquisition (Temporary isolated workspace lifecycle, streaming archive acquisition, configurable limits)
- **Phase 3.2**: Repository Analyzer (Deterministic local workspace inspection, language frequency weighting, framework & package manager detection, monorepo detection, analysisVersion: 2.0.0)
- **Phase 3.3**: Application Structure Detection (Entry points, ports, commands, role detection)
- **Phase 3.4**: Deployment Readiness Report (Deterministic feasibility analysis, blocker detection, scoring matrix)
- **Phase 4**: Automated Containerization & Multi-Cloud Deployment Engine (Dynamic Dockerfile synthesis, Docker execution lifecycle, port allocation, health checking)
- **Phase 5**: Observability, Telemetry & Real-Time Monitoring (Live container metrics, log tailing with secret redaction, incident diagnosis, alert thresholds)
- **Phase 6**: Controlled AI Intelligence (Context sanitization, bounded AI agent tool loop, diagnosis, proposals, and repair suggestions with human approval gate)
- **Phase 7**: Advanced Engineering & CI/CD (Multi-environment management, encrypted environment variables, webhook receiver with HMAC and idempotency, automatic & manual rollbacks, sequential versioning)
- **Phase 8**: Production Hardening & Polish (Security headers with Helmet, global rate limiting with Throttler, global exception filters with zero stack leak, startup config validation, AI timeout guards, orphan workspace cleanup, ANSI stripping, comprehensive documentation)

### Monorepo Structure

```
CloudPilot/
├── apps/
│   ├── web/                     # Next.js 15 App Router + Tailwind CSS (Console UI)
│   └── api/                     # NestJS 11 + TypeScript + Prisma ORM (Backend API)
├── packages/
│   └── shared/                  # Shared TypeScript types, contracts & DTOs
├── infrastructure/
│   └── docker/                  # Isolated execution configurations
├── docs/
│   ├── ARCHITECTURE.md          # Complete system architecture and state machines
│   └── SECURITY.md              # Security model, secrets management, and boundaries
├── .env.example                 # Comprehensive environment configuration template
├── docker-compose.yml           # PostgreSQL 16 & Redis 7 services
├── package.json                 # Monorepo workspaces definition
├── tsconfig.base.json           # Shared TypeScript base configuration
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20+` or `v22+`
- **npm**: `v10+` or `v11+`
- **Docker & Docker Compose** (for PostgreSQL, Redis, and containerized deployments)

### 1. Environment Setup

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

Generate a 32-byte (64 hex characters) encryption key for `GITHUB_TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

*(Never commit `.env` containing sensitive credentials to version control).*

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Synchronization

Generate the Prisma client and push the schema to PostgreSQL:

```bash
npm run db:generate
npm run db:push
```

### 4. Start Infrastructure (PostgreSQL & Redis)

```bash
docker compose up -d
```

### 5. Running Quality & Test Pipelines

```bash
# Run automated API and Web unit/integration tests
npm test

# Run TypeScript type-checking across all workspaces
npm run type-check

# Run ESLint across all workspaces
npm run lint

# Build all packages and applications for production
npm run build
```

### 6. Starting the Applications

```bash
# Start backend API (http://localhost:3001)
npm run dev:api

# Start web frontend console (http://localhost:3000)
npm run dev:web
```

---

## API Endpoints Overview

### Health Check
- `GET /health` — Service health probe (PostgreSQL & Redis) *(Rate limit exempt)*

### Authentication (`/auth`)
- `GET /auth/github` — Initiates GitHub OAuth flow with short-lived CSRF state cookie
- `GET /auth/github/callback` — Handles OAuth callback, encrypts token at rest, issues `cloudpilot_session` cookie
- `GET /auth/me` *(Protected)* — Returns sanitized `UserDto` for the authenticated session
- `POST /auth/logout` — Invalidates server-side session in PostgreSQL and clears cookie

### GitHub Repositories (`/github/repositories`)
- `GET /github/repositories?page=1&perPage=30` *(Protected)* — Lists user repositories with pagination & rate-limit metadata
- `GET /github/repositories/:owner/:repo` *(Protected)* — Retrieves single repository details
- `GET /github/repositories/:owner/:repo/branches?page=1&perPage=30` *(Protected)* — Lists branches for a repository

### Persistent Projects (`/projects`)
- `POST /projects` *(Protected)* — Connects a verified GitHub repository as a persistent CloudPilot project (201 Created)
- `GET /projects` *(Protected)* — Lists all projects belonging to the authenticated user (200 OK)
- `GET /projects/:id` *(Protected)* — Retrieves details for a user's project (returns 404 if not found/owned)
- `DELETE /projects/:id` *(Protected)* — Disconnects/deletes a project record from PostgreSQL (200 OK)

### Repository Intelligence (`/projects/:id`)
- `POST /projects/:id/analyze` *(Protected)* — Runs static repository analysis to detect tech stack, frameworks, manifests & container configs (200 OK)
- `GET /projects/:id/analysis` *(Protected)* — Retrieves latest static analysis for the user's project (200 OK)
- `POST /projects/:id/analyze-structure` *(Protected)* — Runs static application structure detection (roles, entry points, commands, ports, output directories) (200 OK)
- `GET /projects/:id/structure` *(Protected)* — Retrieves latest application structure report for the project (200 OK)
- `POST /projects/:id/analyze-readiness` *(Protected)* — Evaluates deployment feasibility, strategy, scoring, blockers, and recommendations (200 OK)
- `GET /projects/:id/readiness` *(Protected)* — Retrieves latest deployment readiness evaluation for the project (200 OK)
- `POST /projects/:id/acquire-source` *(Protected)* — Acquires repository source into an ephemeral isolated workspace and returns sanitized metadata (200 OK)

### Deployment Engine (`/projects/:id`)
- `POST /projects/:id/deployment-plan` *(Protected)* — Generates dry-run deployment plan with synthesized multi-stage Dockerfile (200 OK)
- `POST /projects/:id/deploy` *(Protected)* — Initiates isolated Docker build, container execution, and health validation (200 OK)
- `POST /projects/:id/deployments/:depId/cancel` *(Protected)* — Cancels active container build or execution (200 OK)
- `GET /projects/:id/deployments` *(Protected)* — Lists all deployment records for a project (200 OK)
- `GET /projects/:id/deployments/:depId` *(Protected)* — Retrieves details for a specific deployment (200 OK)
- `GET /projects/:id/deployments/:depId/logs` *(Protected)* — Retrieves sanitized streaming build and execution logs (200 OK)

### Observability & Telemetry (`/projects/:id/deployments/:depId`)
- `GET /projects/:id/deployments/:depId/telemetry` *(Protected)* — Retrieves live telemetry overview (CPU, Memory, Network, Health, Uptime, Alerts) (200 OK)
- `GET /projects/:id/deployments/:depId/metrics?limit=60` *(Protected)* — Retrieves live and time-series resource metrics for graphing (200 OK)
- `POST /projects/:id/deployments/:depId/metrics/collect` *(Protected)* — Triggers an on-demand container metric snapshot collection (200 OK)
- `GET /projects/:id/deployments/:depId/logs/tail?level=ALL&search=&limit=100` *(Protected)* — Live streaming container log tailer with search and level filters (200 OK)
- `GET /projects/:id/deployments/:depId/events?limit=50` *(Protected)* — Retrieves operational incident alerts and threshold events (200 OK)

### AI Intelligence & Guided Remediation (`/projects/:projectId`)
- `POST /projects/:projectId/ai/understand` *(Protected, Throttled)* — Generates structured tech stack and architecture understanding
- `POST /projects/:projectId/ai/deployment-proposal` *(Protected, Throttled)* — Generates AI deployment proposal and multi-stage Dockerfile
- `POST /projects/:projectId/deployments/:depId/ai/diagnose-build` *(Protected, Throttled)* — Analyzes build logs and extracts root cause diagnosis
- `POST /projects/:projectId/deployments/:depId/ai/diagnose-incident` *(Protected, Throttled)* — Analyzes telemetry and incident events
- `GET /projects/:projectId/deployments/:depId/ai/repair-suggestions` *(Protected)* — Retrieves AI repair suggestions
- `POST /projects/:projectId/ai/repair-suggestions/:suggestionId/approve` *(Protected)* — Human approval gate for AI suggestions
- `POST /projects/:projectId/ai/repair-suggestions/:suggestionId/reject` *(Protected)* — Rejects AI suggestions
- `POST /projects/:projectId/ai/agent` *(Protected, Throttled)* — Runs the bounded, tool-guided AI Agent loop

### Multi-Environment CI/CD (`/projects/:projectId`)
- `GET /projects/:projectId/environments` *(Protected)* — Lists all environments
- `POST /projects/:projectId/environments` *(Protected)* — Creates a new environment
- `GET /projects/:projectId/environments/:envId` *(Protected)* — Gets environment details
- `PATCH /projects/:projectId/environments/:envId` *(Protected)* — Updates environment settings
- `DELETE /projects/:projectId/environments/:envId` *(Protected)* — Deletes an environment
- `GET /projects/:projectId/environments/:envId/variables` *(Protected)* — Lists masked environment variables
- `POST /projects/:projectId/environments/:envId/variables` *(Protected)* — Sets an encrypted variable
- `DELETE /projects/:projectId/environments/:envId/variables/:varId` *(Protected)* — Deletes an environment variable
- `POST /projects/:projectId/deployments/:depId/rollback` *(Protected)* — Triggers rollback to previous healthy deployment
- `GET /projects/:projectId/cicd/settings` *(Protected)* — Retrieves CI/CD & Webhook settings
- `PATCH /projects/:projectId/cicd/settings` *(Protected)* — Updates Webhook secret
- `GET /projects/:projectId/cicd/webhook-events` *(Protected)* — Lists recent webhook delivery events
- `POST /webhooks/github` *(Public, HMAC verified, Rate limit exempt)* — Ingests GitHub push events

---

## Security & Reliability Highlights

1. **AES-256-GCM Encryption**: Tokens, secrets, and environment variables encrypted at rest with random IVs.
2. **Server-Side HTTP-Only Sessions**: Opaque session cookies; zero tokens stored in browser storage.
3. **Defense-in-Depth AI Guardrails**: AI never executes shell or database commands directly; strict timeout (30s), iteration bounds (5), and tool limits (10).
4. **Rate Limiting & DoS Protection**: Global NestJS Throttler (60 req/min) with dedicated strict limits on AI routes (10 req/min).
5. **Zero-Leak Error Handling**: Global exception filters format clean JSON error payloads without stack traces, database strings, or path leaks.
6. **Container Resource & Network Isolation**: Dedicated memory/CPU limits, `--security-opt=no-new-privileges`, and `127.0.0.1` port bindings.
7. **Idempotent CI/CD & Concurrency Safety**: Deployment numbering backed by PostgreSQL `@@unique([projectId, deploymentNumber])` and bounded retry loops.
