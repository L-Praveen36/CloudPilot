# Phase 7 — Advanced Engineering & CI/CD

## Overview

Phase 7 extends CloudPilot with production-grade deployment engineering:
multi-environment management, encrypted configuration secrets, GitHub
webhook-triggered deploys, deterministic deployment versioning, and
one-click rollback with auto-rollback on failure.

```
GitHub Repository
       │
       ▼  (push event)
Webhook Receiver ── HMAC SHA-256 ──► GithubWebhookEvent (audit log)
       │
       ▼  branch → environment mapping
Environment (production / staging / preview / custom)
       │  decrypts AES-256-GCM env vars
       ▼
DeploymentService.deployWithVersion()
       │  allocates sequential deploymentNumber
       │  stamps: commitSha, branch, triggerType, triggeredBy
       ▼
DockerExecutionService (Phase 4 engine, unchanged)
       │
       ├─ SUCCESS ──► RUNNING
       │
       └─ FAILURE ──► evaluateAutoRollback()
                            │
                            └─ finds previous healthy deployment
                               └─ creates new ROLLBACK deployment
```

---

## Data Model (Prisma)

### New Models

#### `Environment`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String (CUID) | PK |
| `name` | String | e.g. "production", "staging" |
| `type` | `EnvironmentType` | PRODUCTION / STAGING / PREVIEW / CUSTOM |
| `branchPattern` | String? | glob matched against push ref |
| `autoDeployEnabled` | Boolean | trigger deploy on matching push |
| `autoRollbackEnabled` | Boolean | auto-rollback on failure |
| `maxRollbackAttempts` | Int | default 3, prevents infinite loops |
| `projectId` | String | FK → Project |

#### `EnvironmentVariable`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String (CUID) | PK |
| `key` | String | env var name |
| `encryptedValue` | String | AES-256-GCM, base64 |
| `iv` | String | 12-byte GCM IV, base64 |
| `authTag` | String | 16-byte GCM auth tag, base64 |
| `isSecret` | Boolean | masked in API responses |
| `environmentId` | String | FK → Environment |

#### `GithubWebhookEvent`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String (CUID) | PK |
| `deliveryId` | String | `X-GitHub-Delivery` header, unique constraint (idempotency) |
| `event` | String | e.g. "push" |
| `status` | `WebhookEventStatus` | RECEIVED / PROCESSING / PROCESSED / FAILED / IGNORED |
| `branch` | String? | parsed from `ref` |
| `commitSha` | String? | `after` field |
| `projectId` | String | FK → Project |

### Enriched Models

**`Deployment`** — added fields:
`deploymentNumber`, `commitSha`, `branch`, `environmentId`,
`configurationVersion`, `buildId`, `triggerType`, `triggeredBy`,
`previousDeploymentId`, `rollbackTargetId`, `isRollback`

**`Project`** — added fields:
`webhookSecret` (bcrypt stored), `defaultBranch`

---

## Services

### `EnvironmentService`
- `ensureDefaultEnvironments(projectId)` — auto-creates PRODUCTION + STAGING on first access
- `getEnvironments(projectId)` — returns all with variable count
- `create / update / delete` — standard CRUD
- `getDecryptedVariablesForExecution(environmentId)` — decrypts AES-256-GCM secrets, returns `Record<string,string>` for Docker injection

### `WebhookReceiverService`
- Verifies `X-Hub-Signature-256` via `crypto.timingSafeEqual` (prevents timing attacks)
- Idempotency: `deliveryId` unique constraint; duplicate events return `{ status: 'DUPLICATE', ignored: true }`
- Branch pattern matching: exact string or glob (`minimatch`)
- On match: finds project with `webhookSecret`, triggers `deploymentService.deployWithVersion(..., triggerType: WEBHOOK)`

### `RollbackService`
- `rollbackDeployment(projectId, deploymentId)` — finds the most recent healthy (RUNNING) deployment before target; creates a new ROLLBACK deployment via `deployWithVersion`
- `evaluateAutoRollback(deployment)` — called by `DeploymentService` on failure; skips if `isRollback === true` or `triggerType === 'ROLLBACK'` (prevents loops); respects `maxRollbackAttempts`

### `CicdService`
- Orchestrates all CI/CD endpoints
- `getCicdSettings` returns: `defaultBranch`, `webhookUrl` (`/webhooks/github`), `autoRollbackOnFailure`, `maxRollbackAttempts`, `environments` summary

---

## API Endpoints

### CicdController (authenticated, `/projects/:projectId/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `environments` | List environments |
| POST | `environments` | Create environment |
| PATCH | `environments/:envId` | Update environment |
| DELETE | `environments/:envId` | Delete environment |
| GET | `environments/:envId/variables` | List variables (secrets masked) |
| PUT | `environments/:envId/variables` | Set variable (upsert) |
| DELETE | `environments/:envId/variables/:key` | Delete variable |
| POST | `deployments/:deploymentId/rollback` | Trigger rollback |
| GET | `cicd` | Get CI/CD settings |
| PATCH | `cicd` | Update CI/CD settings |
| GET | `cicd/webhook-events` | Audit log |

### WebhookController (public, no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/github` | GitHub push event receiver |

---

## Security

| Concern | Mechanism |
|---------|-----------|
| Env var confidentiality | AES-256-GCM with per-variable IV; plaintext never stored |
| Secret masking | `isSecret=true` variables return `value: null` in API responses |
| Webhook authenticity | HMAC-SHA256, timing-safe comparison (`crypto.timingSafeEqual`) |
| Webhook replay | `deliveryId` unique DB constraint; duplicate detected and silently ignored |
| Rollback loops | `isRollback` / `triggerType=ROLLBACK` guard in `evaluateAutoRollback` |
| Environment isolation | Per-environment variable namespacing; production variables never injected into staging |

---

## Frontend Integration

The [project page](file:///c:/Users/prave/Downloads/CloudPilot/apps/web/app/projects/%5Bid%5D/page.tsx) was extended with:

- **Phase 7 CI/CD, Environments & Pipelines Card** — environment tabs, branch pattern editor, auto-deploy/auto-rollback toggles
- **Environment Variables Table** — add/delete, secret column masked
- **Webhook Configuration** — webhook URL display, secret rotation form
- **Webhook Audit Log** — paginated event table with status badges
- **Enhanced Deployment History** — `#` number, environment badge, commit SHA + branch, trigger type badge, rollback button
- **Add Variable Modal** — plaintext/secret toggle
- **Rollback Confirmation Modal** — deployment details + safeguard warning

---

## Testing

| Suite | Tests |
|-------|-------|
| `environment.service.spec.ts` | CRUD, ensureDefaultEnvironments, decryption |
| `webhook-receiver.service.spec.ts` | HMAC validation, idempotency, branch matching |
| `rollback.service.spec.ts` | Rollback orchestration, loop prevention |
| `cicd.controller.spec.ts` | All REST endpoint handlers |
| `webhook.controller.spec.ts` | Public webhook handler |
| `deployment.service.spec.ts` | deployWithVersion integration |
| `api.test.ts` (web) | Phase 7 API client methods |

**Total: 288 API tests + 43 frontend tests — all passing.**

---

## Verification

Run the live verification script (requires running stack):
```bash
CLOUDPILOT_SESSION_COOKIE="..." node verify_phase_7.js
```

The script executes **27 live assertions** covering:
1. Default environment auto-creation
2. Environment CRUD lifecycle
3. Secret masking in variable responses
4. CI/CD settings persistence
5. Webhook HMAC rejection (missing / invalid signature)
6. Webhook audit log endpoint
7. Rollback endpoint 404 on missing deployment
8. Environment deletion + confirmation
