# CloudPilot Phase 3.3 — Application Structure Detection

## 1. Purpose & Master Roadmap Context

Phase 3.3 implements **Application Structure Detection**, building on the existing Foundation, Auth, Repository API, Project Persistence, and Repository Intelligence phases:

```text
Phase 3 — Repository Intelligence

3.1 — Repository Source Acquisition        ✅ COMPLETE
3.2 — Repository Analyzer                  ✅ COMPLETE
3.3 — Application Structure Detection      ✅ COMPLETE (THIS PHASE)
3.4 — Deployment Readiness Report          (Next Phase)
```

The Phase 3.3 Analyzer statically inspects the acquired temporary isolated workspace from Phase 3.1 (`RepositorySourceService.withRepositorySource()`) to determine the runtime structure, application roles, entry points, build/start commands, ports, output directories, and multi-app topologies.

---

## 2. Architecture & Service Boundaries

```text
POST /projects/:id/analyze-structure
GET /projects/:id/structure
                 │
                 ▼
    AuthGuard (Session validation)
                 │
                 ▼
RepositoryIntelligenceController
                 │
                 ▼
RepositoryIntelligenceService
                 │
                 ▼
RepositorySourceService.withRepositorySource(userId, projectId, callback)
                 │
                 ▼
   Temporary Isolated Workspace (os.tmpdir()/cp-src-*)
                 │
                 ▼
ApplicationStructureService.detectStructure(workspacePath)
                 │
                 ├── 1. Monorepo / Multi-App Discovery (apps/*, services/*, packages/*)
                 ├── 2. Deterministic Application Role Detection (Frontend, Backend, Fullstack, API, Worker, CLI, Library)
                 ├── 3. Entry Point Deterministic Ranking (app/page.tsx, src/main.tsx, main.py, etc.)
                 ├── 4. Declared vs. Inferred Build Command Discovery
                 ├── 5. Declared vs. Inferred Start Command Discovery
                 ├── 6. Safe Port Detection (.env.example, Dockerfile EXPOSE, framework defaults)
                 ├── 7. Configured & Conventional Output Directory Detection
                 ├── 8. Frontend / Backend Relationship Mapping (Proxy, Client-Server)
                 └── 9. Deterministic Sorting & Confidence Scoring (HIGH, MEDIUM, LOW)
                 │
                 ▼
Persist Structure JSON on RepositoryAnalysis in PostgreSQL (1:1 with Project)
                 │
                 ▼
Return Sanitized ApplicationStructureDto
                 │
                 ▼ (finally)
Guaranteed Workspace Directory Cleanup (rm -rf)
```

---

## 3. Core Capabilities & Detection Rules

### 3.1 Application Roles
- **`FRONTEND`**: Next.js, React, Vite, Angular, Vue, Svelte, Nuxt with web UI assets (`index.html`, `src/app`, `src/pages`, `app/`, `public/`) without server listen bindings.
- **`BACKEND` / `API`**: NestJS, Express, Fastify, FastAPI, Django, Flask, Spring Boot, Go server endpoints, or presence of API routes and database drivers without UI assets.
- **`FULLSTACK`**:
  - Full-stack frameworks (Next.js App Router with server actions / API routes, Nuxt, Remix).
  - Repositories or monorepos containing both frontend and backend sub-applications.
- **`WORKER`**: Background queue consumers (BullMQ, Celery, Kafka/RabbitMQ consumer scripts) without HTTP ports.
- **`CLI`**: Executable bin entries in `package.json` (`bin`), `argparse`/`click` in Python, or command-line main entry points.
- **`LIBRARY`**: Packages with `main`/`module`/`exports` in `package.json` without runnable start scripts or server ports.
- **`UNKNOWN`**: Insufficient static evidence.

### 3.2 Entry Point Ranking
Deterministic ranking based on language & framework conventions:
1. **TypeScript/JavaScript**:
   - Framework roots: `app/page.tsx`, `src/app/page.tsx`, `pages/index.tsx`, `src/pages/index.tsx`, `src/main.tsx`, `src/main.ts`, `src/index.tsx`, `src/index.ts`
   - Server roots: `src/server.ts`, `server.ts`, `src/app.ts`, `app.ts`
   - Node roots: `server.js`, `app.js`, `index.js`, `main.js`
2. **Python**: `main.py`, `app.py`, `server.py`, `manage.py`, `wsgi.py`, `asgi.py`
3. **Java**: Spring Boot Application classes with `@SpringBootApplication` or `public static void main` in `src/main/java`
4. **Go**: `main.go`, `cmd/*/main.go`

### 3.3 Build & Start Commands
- **Declared**: Read directly from `package.json.scripts.build`, `package.json.scripts.start`, `pyproject.toml.scripts`, `pom.xml`, `build.gradle` (tagged with `isDeclared: true`).
- **Inferred**: Derived deterministically from framework conventions (e.g. Next.js -> `next build`, `next start`; Vite -> `vite build`, `vite preview`; Maven -> `mvn package`; Go -> `go build`, `go run .`) with `isDeclared: false`.

### 3.4 Safe Port Detection
Inspected from:
1. Safe `.env.example` / `.env.sample` (`PORT=3000`, `APP_PORT=8080`) — never secret `.env` files.
2. Dockerfile `EXPOSE <port>` directives.
3. Framework default conventions (Next.js/NestJS: 3000, Vite: 5173, Angular: 4200, FastAPI/Django: 8000, Flask: 5000, Spring Boot: 8080).

### 3.5 Output Directories
- Configured or convention: Vite (`dist`), Next.js (`.next`), NestJS (`dist`), Angular (`dist`), Maven (`target`), Gradle (`build`).

### 3.6 Multi-Application / Monorepo Topologies
- Discovers sub-applications under `apps/*`, `packages/*`, `services/*`, `frontend`, `backend`, `client`, `server`.
- Distinguishes deployable applications from shared libraries.
- Maps client-server or proxy relationships (e.g. `web` → `api` via `CLIENT_SERVER` or `PROXY`).

---

## 4. Security & Safety Guarantees

1. **Strict Static Inspection Only**: Zero execution of repository scripts (`npm install`, `npm start`, `python`, `pip`, `docker build`, etc.).
2. **Secret Protection**: Real `.env`, `.env.local`, `*.pem`, `*.key` files are never read or returned.
3. **Workspace Isolation**: Ephemeral directory under `os.tmpdir()/cp-src-*`, deleted in `finally` on both success and failure.
4. **Credential Isolation**: Tokens, database URLs, and server filesystem paths are never leaked in DTO responses.
5. **Cross-User Isolation**: Every endpoint validates `project.userId === req.user.id`, returning 404 for unowned projects.

---

## 5. Phase 3.4 Integration Seam

Phase 3.4 will consume both:
- `RepositoryAnalysis` (Stack, Language, Framework, Monorepo flags)
- `ApplicationStructure` (Roles, Entry Points, Commands, Ports, Output Dirs, Relationships)

to generate the **Deployment Readiness Report**.
