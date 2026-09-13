# CloudPilot — System Architecture & Design

> **Production Architecture & Technical Design Document**
> Version: 1.0.0 (Phase 8 Production Hardening)

---

## 1. Executive Summary

CloudPilot is an automated deployment, repository intelligence, and observability platform that bridges source repositories with self-healing, multi-environment cloud execution. The system strictly separates AI analysis (non-destructive advisory) from deterministic execution engines (hardened security, resource boundaries, and state machines).

---

## 2. Monorepo Topology

```
CloudPilot/
├── apps/
│   ├── api/                     # NestJS 11 + Prisma ORM + Docker Execution (Backend Core)
│   └── web/                     # Next.js 15 App Router + Tailwind CSS (Console UI)
├── packages/
│   └── shared/                  # Shared TypeScript types, contracts, DTOs, & enums
├── infrastructure/
│   └── docker/                  # Isolated deployment container configs
├── docs/                        # Architecture & security specifications
├── docker-compose.yml           # Local PostgreSQL 16 & Redis 7 services
└── .env.example                 # Config template with security defaults
```

---

## 3. High-Level System Architecture

```text
[ GitHub VCS ]
      │
      │ (OAuth, Tarball API, Webhook HMAC)
      ▼
[ CloudPilot API Gateway (NestJS 11) ]
  ├── Security Layer (Helmet, CORS, Cookie Sessions, Throttler Guard 60 req/min)
  ├── Global Exception Filters (Zero Stack Leak, Unified RFC-7807-like JSON)
  ├── Repository Intelligence Engine
  │     ├── Repository Source (Ephemeral Workspace, Path Traversal Guard, Strip Components)
  │     ├── Static Analyzer (Deterministic Weighting, Language & Framework Detection)
  │     ├── Application Structure Detector (Entry points, ports, commands)
  │     └── Deployment Readiness Evaluator (Blockers, scoring, strategy)
  ├── Automated Deployment Engine
  │     ├── Concurrency-Safe Sequential Deployment Numbering (P2002 Retry Loop)
  │     ├── Dynamic Multi-Stage Dockerfile Synthesizer
  │     ├── Docker Daemon Execution (Bounded CPU, Memory, Localhost 127.0.0.1 Binding)
  │     └── Autonomous Health Probe & Auto-Rollback Engine
  ├── Real-Time Observability Engine
  │     ├── Live Container Metric Streaming (CPU %, Memory, Network I/O, PIDs)
  │     ├── Log Tailer & Secret Redaction (ANSI Strip, Token & Password Scrubbing)
  │     └── Incident Diagnosis & Event Alerting
  └── AI Advisory Layer (PROPOSES / ANALYZES ONLY)
        ├── Context Sanitizer & Token Redaction
        ├── Bounded Tool Execution Loop (Max 5 Iterations, Max 10 Tool Calls)
        ├── 30-Second AI Timeout Guard & Deterministic Fallbacks
        └── Human Approval Gate for Remediation / Repairs
```

---

## 4. Deployment Lifecycle State Machine

```text
[ PENDING ] 
     │
     ▼
[ VALIDATING ] ──(Docker Unavailable / Missing Vars)──► [ FAILED ]
     │                                                     │
     ▼                                                     ▼
[ BUILDING ]   ──(Build Failure / Timeout)────────────► [ Auto-Rollback? ]
     │                                                     │
     ▼                                                     ├──► [ ROLLBACK Triggered ]
[ STARTING ]   ──(Port Conflict / Crash)───────────────┤
     │                                                     ▼
     ▼                                              [ UNHEALTHY / FAILED ]
[ HEALTH_CHECKING ] ──(Probe Timeout / Unhealthy)─────►
     │
     ▼
[ RUNNING ] ◄──(Active Health Monitoring)
     │
     ├── User Cancellation ──► [ CANCELLED ]
     └── Container Crash   ──► [ FAILED ] ──► [ Auto-Rollback Evaluation ]
```

---

## 5. Multi-Environment & CI/CD Pipelines

Each connected project automatically provisions isolated environments:
1. **Development** (`DEVELOPMENT`): default branch `develop`, manual/auto-deploy.
2. **Staging** (`STAGING`): default branch `staging`, integration verification.
3. **Production** (`PRODUCTION`): default branch `main`, rollback-protected.
4. **Preview / Custom** (`PREVIEW`, `CUSTOM`): feature branch and custom PR deployments.

### Webhook Ingestion & Idempotency
- Incoming GitHub webhook delivery payloads are validated via HMAC `X-Hub-Signature-256`.
- Unique `X-GitHub-Delivery` delivery IDs prevent duplicate triggers via database unique constraints (`P2002` deduplication).

---

## 6. Observability & Self-Healing Architecture

1. **Active Container Telemetry**: Real-time stats collected via container inspect and socket streams, aggregated into hourly rolling windows.
2. **Deterministic Auto-Rollback**: On deployment failure in rollback-enabled environments, CloudPilot locates the latest healthy previous deployment and initiates an immutable rollback deployment (`triggerType: ROLLBACK`), bounded by `maxRollbackAttempts` per hour.
