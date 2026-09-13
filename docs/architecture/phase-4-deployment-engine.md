# CloudPilot Phase 4 — Deployment Engine Architecture

## 1. Purpose & Master Roadmap Context

Phase 4 implements the complete **Deployment Engine** for CloudPilot:

```text
Phase 1 — Foundation (NestJS + Next.js + PostgreSQL + Redis)
Phase 2 — GitHub OAuth, Repository API, Dashboard & Project Persistence
Phase 3 — Repository Intelligence (3.1 Acquisition, 3.2 Stack Analysis, 3.3 Structure Detection, 3.4 Readiness Evaluation)
Phase 4 — Deployment Engine                                                                ✅ COMPLETE (THIS PHASE)
```

The Phase 4 Deployment Engine consumes the static outputs of Phase 3 (`RepositoryAnalysis`, `ApplicationStructure`, and `DeploymentReadiness`) and translates them into an isolated, multi-stage Docker build, managed container execution, automated health monitoring, sanitized logging, and complete deployment lifecycle management.

---

## 2. Architecture & Deployment Workflow

```text
POST /projects/:id/deployment-plan  (Dry-run plan generation)
POST /projects/:id/deploy           (Trigger container build & execution)
POST /projects/:id/deployments/:depId/cancel (Cancel active deployment)
GET  /projects/:id/deployments      (List deployment history)
GET  /projects/:id/deployments/:depId (Deployment details)
GET  /projects/:id/deployments/:depId/logs (Sanitized execution logs)
                 │
                 ▼
      AuthGuard (Session validation)
                 │
                 ▼
       DeploymentController
                 │
                 ▼
        DeploymentService
                 │
                 ├── 1. Concurrency Guard (Check no other deployment is active for this project)
                 ├── 2. Create Deployment record with status PENDING in PostgreSQL
                 │
                 ▼
    RepositorySourceService.withRepositorySource(userId, projectId, async (ctx) => {
        │
        ▼
    1. DeploymentPlanService.generatePlan(workspacePath, analysis, structure, readiness)
        ├── Determine strategy (STATIC_FRONTEND, NODE_APPLICATION, PYTHON, JAVA, GO, DOCKER)
        ├── Synthesize optimized, secure multi-stage Dockerfile (or validate existing Dockerfile)
        ├── Determine exposed port & health-check protocol (HTTP / PROCESS / STATIC)
        └── Output structured DeploymentPlan
        │
        ▼
    2. DockerExecutionService.buildImage(workspacePath, imageTag, deploymentId, onLog)
        ├── Resource limits (512MB RAM, 1.0 CPU, 5m timeout)
        ├── Safe process execution using child_process.spawn (WITHOUT shell: true)
        ├── Live log streaming with secret masking & truncation guards
        └── Output build summary & duration
        │
        ▼
    3. DockerExecutionService.runContainer(imageTag, containerName, hostPort, containerPort, env, onLog)
        ├── Port binding restricted to 127.0.0.1:<hostPort>:<containerPort>
        ├── Safe container spawn with memory and CPU boundaries
        └── Container ID tracking
        │
        ▼
    4. DockerExecutionService.checkHealth(containerName, hostPort, healthStrategy, healthPath, onLog)
        ├── HTTP health polling with retry backoff (up to 30s)
        ├── Process liveness check for background/worker containers
        └── Output health status (HEALTHY / UNHEALTHY)
        │
        ▼
    5. Update Deployment record:
        ├── status: RUNNING (or FAILED if health check/build fails)
        ├── healthStatus: HEALTHY / UNHEALTHY
        ├── url: http://127.0.0.1:<hostPort>
        ├── logs: persisted sanitized log entries
        └── completedAt: timestamp
    })
                 │
                 ▼ (finally)
    Guaranteed Workspace Cleanup (rm -rf temporary directory)
```

---

## 3. Key Components

### 3.1 `DeploymentPlanService`
- Generates reproducible, multi-stage Dockerfiles tailored to the detected language, framework, and package manager:
  - **Static Frontend**: Multi-stage Node builder + Nginx Alpine runner (`/usr/share/nginx/html`).
  - **Node.js / Next.js**: Multi-stage `node:18-alpine` with production pruning and non-root execution.
  - **Python / FastAPI / Django**: Multi-stage `python:3.11-slim` with virtualenv and unbuffered output.
  - **Java / Spring Boot**: Multi-stage `maven:3.9-eclipse-temurin-17` builder + `eclipse-temurin:17-jre-alpine` runner.
  - **Go**: Multi-stage `golang:1.21-alpine` builder + minimal `alpine:3.19` runner.
  - **Docker**: Inspects existing `Dockerfile` for security and syntax validity.
- Evaluates blockers, warnings, and required environment variables before allowing deployment.

### 3.2 `DockerExecutionService`
- Executes Docker CLI commands via direct `child_process.spawn` (no shell interpolation).
- Allocates free host ports on `127.0.0.1` dynamically to avoid port collisions.
- Provides real-time log capturing with automatic log sanitization:
  - Redacts GitHub tokens, OAuth secrets, database passwords, and Bearer tokens.
  - Strips ANSI color codes and normalizes timestamps.
  - Enforces a 1MB maximum log ceiling to prevent memory exhaustion.
- Conducts HTTP and process-level health checks with customizable timeouts.

### 3.3 `DeploymentService`
- Orchestrates the full deployment state machine:
  `PENDING` -> `VALIDATING` -> `BUILDING` -> `STARTING` -> `HEALTH_CHECKING` -> `RUNNING` (or `FAILED` / `CANCELLED`).
- Handles graceful cancellation: terminates running build processes, stops containers, and marks state as `CANCELLED`.
- Enforces strict cross-tenant isolation and ownership checks.

---

## 4. Security & Isolation Guarantees

1. **Host Execution Prevention**: No repository code, package scripts, build tools (`npm`, `mvn`, `pip`, etc.) are ever executed directly on the host machine. All compilation and execution occur strictly inside isolated Docker containers.
2. **No Shell Interpolation**: All external commands use direct executable argument arrays without `shell: true`.
3. **Localhost Binding**: Exposed ports are explicitly bound to `127.0.0.1:<hostPort>:<containerPort>` so that containers are not directly exposed to external public interfaces.
4. **Credential Protection**: Deployment logs and error messages are sanitized before database storage and API delivery.
5. **Guaranteed Cleanup**: Workspace directory removal is guaranteed in `finally` blocks via `RepositorySourceService.withRepositorySource()`.
