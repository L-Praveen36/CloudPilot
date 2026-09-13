# CloudPilot Phase 3.4 — Deployment Readiness & Feasibility Analysis

## 1. Purpose & Master Roadmap Context

Phase 3.4 implements **Deployment Readiness & Feasibility Analysis**, completing Phase 3 (Repository Intelligence):

```text
Phase 3 — Repository Intelligence

3.1 — Repository Source Acquisition        ✅ COMPLETE
3.2 — Repository Analyzer                  ✅ COMPLETE
3.3 — Application Structure Detection      ✅ COMPLETE
3.4 — Deployment Readiness Report          ✅ COMPLETE (THIS PHASE)
```

The Phase 3.4 Analyzer consumes the static outputs of Phase 3.2 (`RepositoryAnalyzerService`) and Phase 3.3 (`ApplicationStructureService`) to produce a deterministic, explainable readiness evaluation without executing any repository code.

---

## 2. Architecture & Service Flow

```text
POST /projects/:id/analyze-readiness
GET  /projects/:id/readiness
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
RepositorySourceService.withRepositorySource(userId, projectId, async (ctx) => {
    │
    ▼
1. RepositoryAnalyzerService.analyzeWorkspace()       (Phase 3.2 stack analysis)
    │
    ▼
2. ApplicationStructureService.detectStructure()       (Phase 3.3 structure discovery)
    │
    ▼
3. DeploymentReadinessService.analyzeReadiness()       (Phase 3.4 readiness evaluation)
    ├── Strategy Resolution (STATIC_FRONTEND, NODE_APPLICATION, PYTHON, JAVA, GO, DOCKER, MULTI_APP)
    ├── Deterministic Score Calculation (0-100 across 7 weighted categories)
    ├── Blocker Identification (missing runtime, missing build command, unsupported roles)
    ├── Warning & Optimization Detection (inferred commands, missing .env.example)
    ├── Environment Requirement Extraction (.env.example variables)
    ├── Monorepo Per-Sub-App Evaluation
    └── Actionable Recommendation Generation (Prioritized HIGH, MEDIUM, LOW)
    │
    ▼
Persist combined analysis JSON to RepositoryAnalysis in PostgreSQL (1:1 with Project)
    │
    ▼
Return Sanitized DeploymentReadinessDto
})
                 │
                 ▼ (finally)
Guaranteed Workspace Directory Cleanup (rm -rf)
```

---

## 3. Deployment Strategies

| Strategy | Target Application Characteristics |
|:---|:---|
| `STATIC_FRONTEND` | Static web UI apps (Vite, React static, Angular) with build command and static output dir (`dist`). |
| `NODE_APPLICATION` | Full-stack Next.js/Nuxt apps or backend Node.js apps (NestJS, Express) with runtime start scripts. |
| `PYTHON_APPLICATION` | FastAPI, Django, Flask, or Python backend services with WSGI/ASGI entrypoints. |
| `JAVA_APPLICATION` | Spring Boot applications with Maven (`mvn package`) or Gradle configurations. |
| `GO_APPLICATION` | Go server applications with `go build` and binary executable conventions. |
| `DOCKER_APPLICATION` | Services with explicit `Dockerfile` containing `FROM` and `CMD`/`ENTRYPOINT` definitions. |
| `MULTI_APPLICATION` | Monorepos with multiple deployable applications (e.g. `apps/web` + `apps/api`). |
| `UNSUPPORTED` | Standalone CLI tools or internal shared libraries not intended for direct web deployment. |
| `UNKNOWN` | Unclassifiable repositories lacking sufficient static evidence. |

---

## 4. Deterministic Scoring Model (0–100)

The readiness score is calculated across 7 weighted categories:

```text
Category                             Max Points
───────────────────────────────────────────────
1. Application Identity                  15
2. Build Readiness                       20
3. Runtime / Start Readiness             20
4. Port Readiness                        15
5. Output Artifact Readiness             10
6. Environment Configuration             10
7. Deployment Strategy                   10
───────────────────────────────────────────────
Total                                   100
```

### Interpretation
- `90–100` → **`READY`**: Fully deployable with 0 blockers and 0 high-severity warnings.
- `70–89`  → **`READY_WITH_WARNINGS`**: Deployable with non-blocking warnings or optimization suggestions.
- `< 70`   → **`BLOCKED`**: Blocked by missing runtime, missing build command, unsupported role, or critical configuration gap.

---

## 5. Security & Safety Guarantees

1. **Zero Code Execution**: Analysis is completely static — no `npm`, `python`, `mvn`, `gradle`, `go`, or `docker` processes are executed.
2. **Zero Secret Exposure**: Real `.env`, `.env.local`, `*.pem`, `*.key` files are never read or returned.
3. **Workspace Isolation**: Ephemeral workspaces created under `os.tmpdir()/cp-src-*` are deleted in `finally` on both success and failure.
4. **Ownership Isolation**: Every endpoint validates `project.userId === req.user.id`, returning 404 for unowned projects.

---

## 6. Phase 4 Deployment Engine Integration Seam

Phase 4 will consume:
- `RepositoryAnalysisDto.strategy` to choose the deployment builder (e.g., Static Builder, Node Builder, Docker Builder).
- `RepositoryAnalysisDto.readiness.requirements` to prompt for required environment variables.
- `RepositoryAnalysisDto.structure.topLevelPort` to configure ingress routing.
