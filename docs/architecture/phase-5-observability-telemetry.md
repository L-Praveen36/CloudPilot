# CloudPilot Phase 5 — Observability, Telemetry & Real-Time Monitoring

## 1. Purpose & Master Roadmap Context

Phase 5 implements the complete **Observability, Telemetry & Real-Time Monitoring** system for CloudPilot:

```text
Phase 1 — Foundation (NestJS + Next.js + PostgreSQL + Redis)
Phase 2 — GitHub OAuth, Repository API, Dashboard & Project Persistence
Phase 3 — Repository Intelligence (3.1 Acquisition, 3.2 Stack Analysis, 3.3 Structure Detection, 3.4 Readiness Evaluation)
Phase 4 — Deployment Engine (Multi-stage Docker, safe container execution, health checking)
Phase 5 — Observability, Telemetry & Real-Time Monitoring                                  ✅ COMPLETE (THIS PHASE)
```

The Phase 5 Observability System consumes the running containers and deployments managed by Phase 4 and provides deep, real-time resource telemetry, metric time-series persistence, live container log streaming and filtering, active health probing with latency tracking, and an automated incident alert notification engine.

---

## 2. Architecture & Service Workflow

```text
GET  /projects/:id/deployments/:depId/telemetry        (Consolidated telemetry overview)
GET  /projects/:id/deployments/:depId/metrics          (Time-series & current metric snapshot)
POST /projects/:id/deployments/:depId/metrics/collect  (On-demand live metric collection)
GET  /projects/:id/deployments/:depId/logs/tail        (Live tail logs with search & level filters)
GET  /projects/:id/deployments/:depId/events           (Incident alerts and event history)
                 │
                 ▼
      AuthGuard (Session validation)
                 │
                 ▼
     ObservabilityController
                 │
                 ▼
      ObservabilityService (Enforces Project & Deployment Ownership)
                 │
        ┌────────┴────────────────────────┬────────────────────────┐
        ▼                                 ▼                        ▼
ContainerTelemetryService        ObservabilityLogService    ObservabilityHealthService
  ├── docker stats (safe spawn)    ├── docker logs --tail     ├── HTTP probe (latency ms)
  ├── CPU & Memory %               ├── Secret sanitization    ├── Process liveness probe
  ├── Network IN/OUT bytes         ├── ANSI color stripping   └── Health state resolver
  ├── Threshold alerts (>85%)      └── Level & text search
  └── Persist to DeploymentMetric
                 │
                 ▼
   PostgreSQL (DeploymentMetric, DeploymentEvent) & Real-Time UI Streaming
```

---

## 3. Key Components

### 3.1 `ContainerTelemetryService`
- Inspects running Docker containers (`docker inspect`) to extract running status, container uptime, OOM events, and process IDs (PIDs).
- Collects live CPU, memory (used, limit, percentage), network throughput (bytes in/out), and block I/O via `docker stats --no-stream --format "{{json .}}"`.
- Detects resource thresholds and records automated incident events:
  - `HIGH_CPU_USAGE` (>85% Warning, >95% Critical)
  - `HIGH_MEMORY_USAGE` (>85% Warning, >95% Critical)
  - `CONTAINER_OOM` (Out-of-memory killed)
  - `CONTAINER_EXIT` (Unexpected non-zero exit code)
- Stores snapshot time-series in PostgreSQL `DeploymentMetric` and provides aggregated stats (average CPU, peak memory, total network transfer).

### 3.2 `ObservabilityLogService`
- Streams live container logs directly from Docker (`docker logs --tail N --timestamps`) or retrieves stored logs when containers have stopped.
- Sanitizes logs automatically: redacts GitHub tokens (`ghp_*`), OAuth tokens, Bearer tokens, and database passwords; strips ANSI color codes.
- Supports rich client queries: filter by log level (`ALL`, `INFO`, `WARN`, `ERROR`), search pattern matching, timestamp bounds (`since`), and pagination limits.

### 3.3 `ObservabilityHealthService`
- Performs active HTTP probes against container ports on `127.0.0.1:<hostPort>` with sub-millisecond latency measurements.
- Evaluates health status: `HEALTHY` (2xx/3xx/404, latency < 1500ms), `DEGRADED` (latency >= 1500ms), or `UNHEALTHY` (5xx or connection error).
- Performs fallback process liveness checks for non-HTTP background worker containers.

### 3.4 `ObservabilityService` & `ObservabilityController`
- Unified facade that enforces project ownership and deployment existence checks (returns `404 Not Found` for unowned projects).
- Coordinates live telemetry snapshots, historical charting series, live tail logs, and operational alerts.

### 3.5 Frontend Observability Console (`apps/web/`)
- Live Observability Dashboard integrated into the project detail page.
- Real-time resource KPI meters: CPU gauge (color-coded), Memory utilization bar, Network I/O counters, and Container Health & Uptime badge.
- Incident & Operational Event feed with severity chips (`CRITICAL`, `WARNING`, `INFO`).
- Live Container Log Viewer with instant text search, log level selector, auto-scroll, and auto-refresh toggle.

---

## 4. Security & Isolation Controls

1. **Server-Side Ownership Enforcement**: All observability endpoints verify that the requesting user (`req.user.id`) owns both the project and the deployment in PostgreSQL. Unauthorized cross-user requests receive `404 Not Found`.
2. **Safe Process Execution**: All Docker commands (`docker inspect`, `docker stats`, `docker logs`) are spawned directly using explicit argument arrays without shell interpolation (`shell: false`).
3. **Secret Redaction**: All log messages and error messages are sanitized before database storage or API delivery. Tokens, passwords, and API keys are redacted with `[REDACTED]`.
4. **ANSI Escape Stripping**: Prevents terminal escape sequence injection in the web UI.
5. **Memory & Buffer Ceilings**: Log queries are bounded to 1,000 lines per request and metrics history to 500 points to prevent backend memory exhaustion.

---

## 5. Scope Boundary & Future Roadmap

- **Completed in Phase 5**: Container resource telemetry, historical metrics series, live log streaming and search, active health probing with latency, automated threshold incident alerts, and frontend observability dashboard.
- **Reserved for Future Phases**: Multi-cloud distributed tracing (OpenTelemetry collector), external Prometheus/Grafana exporters, custom alert webhooks (Slack/PagerDuty/Email), and multi-node cluster monitoring.
