# CloudPilot Architecture — Phase 3.2: Repository Analyzer

## 1. Roadmap Context

The Master CloudPilot Roadmap defines Phase 3 as:

```text
Phase 3 — Repository Intelligence

3.1 — Repository Source Acquisition        ✅ COMPLETE
3.2 — Repository Analyzer                  ← (This Phase)
3.3 — Application Structure Detection
3.4 — Deployment Readiness Report
```

---

## 2. Overview & Objective

Phase 3.2 implements the **deterministic Repository Analyzer** for CloudPilot. Operating directly on the acquired local repository source inside the ephemeral temporary workspace from Phase 3.1, the analyzer performs static, explainable, and deterministic inspection to detect:
- Primary project types (`WEB_APPLICATION`, `PYTHON_APPLICATION`, `JAVA_APPLICATION`, `GO_APPLICATION`, `DOCKER_APPLICATION`, `UNKNOWN`)
- Primary programming languages and language distributions
- Application frameworks (Next.js, NestJS, Vite, React, Angular, Express, FastAPI, Django, Flask, Spring Boot, Go)
- Package managers (pnpm, yarn, npm, poetry, pipenv, pip, maven, gradle, go, cargo)
- Monorepo structures (pnpm workspaces, Turborepo, Nx, Lerna, package.json workspaces, nested apps)
- Key configuration and manifest files (sorted alphabetically, capped at 50)
- Structural markers (`hasDockerfile`, `hasDockerCompose`, `hasEnvExample`)

All analysis results are persisted in PostgreSQL against the `RepositoryAnalysis` model under version `2.0.0`.

---

## 3. Architecture & Data Flow

```text
POST /projects/:id/analyze
            │
            ▼
RepositoryIntelligenceController (AuthGuard)
            │
            ▼
RepositoryIntelligenceService.analyzeProject()
            │
            ▼
RepositorySourceService.withRepositorySource(userId, projectId, async (ctx) => {
    │
    ▼
RepositoryAnalyzerService.analyzeWorkspace(ctx.workspacePath)
    ├── 1. Bounded filesystem walk (skips node_modules, .git, dist, .next, etc.)
    ├── 2. Extension frequency / weighting for deterministic Language detection
    ├── 3. Safe static manifest parsing (package.json, pyproject.toml, pom.xml, go.mod, etc.)
    ├── 4. Deterministic Framework & Package Manager detection
    ├── 5. Monorepo detection (workspaces, turbo, nx, lerna, nested apps)
    ├── 6. Structural flags (Dockerfile, Docker Compose, .env.example)
    └── 7. Deterministic, sorted detectedFiles collection
    │
    ▼
Prisma: Upsert RepositoryAnalysis (analysisVersion: "2.0.0")
    │
    ▼
Return sanitized RepositoryAnalysisDto
})
            │
            ▼ (finally)
Guaranteed Workspace Cleanup (rm -rf workspace)
```

---

## 4. Detection Rules & Priority

### 4.1 Primary Project Type
1. `WEB_APPLICATION`: Presence of JavaScript/TypeScript framework, `package.json`, `tsconfig.json`, or web source files.
2. `PYTHON_APPLICATION`: Presence of `requirements.txt`, `pyproject.toml`, `Pipfile`, `poetry.lock`, or `.py` files.
3. `JAVA_APPLICATION`: Presence of `pom.xml`, `build.gradle`, `build.gradle.kts`, or `.java` files.
4. `GO_APPLICATION`: Presence of `go.mod` or `.go` files.
5. `DOCKER_APPLICATION`: Presence of `Dockerfile` when no higher-priority application manifest exists.
6. `UNKNOWN`: Insufficient evidence.

### 4.2 Language Detection & Weighting
- Scans file extensions across all non-ignored directories.
- Supported languages: TypeScript, JavaScript, Python, Java, Go, HTML, CSS, C, C++, Rust, PHP, Ruby, Shell.
- Primary language is chosen by highest file frequency; ties are broken alphabetically.

### 4.3 Package Manager Priority
- **JavaScript/TypeScript**: `pnpm-lock.yaml` / `pnpm-workspace.yaml` (`pnpm`) > `yarn.lock` (`yarn`) > `package-lock.json` (`npm`) > `package.json` (`npm`)
- **Python**: `poetry.lock` / `[tool.poetry]` (`poetry`) > `Pipfile` / `Pipfile.lock` (`pipenv`) > `requirements.txt` / `pyproject.toml` (`pip`)
- **Java**: `pom.xml` (`maven`) > `build.gradle` / `build.gradle.kts` (`gradle`)
- **Go**: `go.mod` (`go`)
- **Rust**: `Cargo.toml` (`cargo`)

### 4.4 Monorepo Signals
- Dedicated workspace files: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`
- `workspaces` field in `package.json` (array or object)
- Directory presence of nested package manifests: `apps/*/package.json`, `packages/*/package.json`, `services/*/package.json`

---

## 5. Security & Isolation Guarantees

1. **Zero Code Execution**: The analyzer performs read-only static file inspection. Never runs `npm`, `python`, `pip`, `docker`, or repository-provided scripts.
2. **Ignored Directories**: Recursively skips `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `out`, `target`, `vendor`, `__pycache__`, `.venv`, `venv`.
3. **Bounded File Reads**: Manifests are read with a strict 1 MB size limit; files exceeding the limit are skipped safely.
4. **Secret File Protection**: Secret files (`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`) are never read, logged, or returned in API DTOs.
5. **Deterministic Output**: Output collections (`detectedFiles`) are sorted alphabetically, ensuring identical results for identical snapshots.

---

## 6. Integration Seam with Phase 3.3

Phase 3.2 provides the foundation for Phase 3.3 (Application Structure Detection):
- Phase 3.3 will consume the repository analysis result and local workspace to infer entry points, ports, and multi-service topologies without re-implementing source acquisition or base stack detection.
