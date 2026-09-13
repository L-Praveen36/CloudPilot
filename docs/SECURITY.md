# CloudPilot — Security Model & Hardening Guide

> **Security & Defense-in-Depth Specification**
> Version: 1.0.0 (Phase 8 Production Hardening)

---

## 1. Core Security Principles

CloudPilot operates under strict defense-in-depth principles:
1. **Least Privilege**: Zero unnecessary process permissions, no host socket mounts, non-root container defaults.
2. **Zero Trust Session Model**: Server-side opaque session identifiers with encrypted tokens at rest.
3. **Deterministic Safety Boundary**: AI suggests and analyzes; only verified deterministic code executes actions.
4. **Complete Data Isolation**: Multi-tenant ownership verification on all resource routes.

---

## 2. Secrets & Encryption Architecture

### 2.1 AES-256-GCM Token Storage
- GitHub OAuth Access Tokens and Webhook HMAC Secrets are encrypted at rest using AES-256-GCM authenticated encryption.
- Master Key: 256-bit (64 hex characters) loaded from `GITHUB_TOKEN_ENCRYPTION_KEY`.
- Encryption payload structure: `iv:authTag:ciphertext` (random 12-byte IV per encryption operation).
- Decryption occurs strictly in memory for outbound requests; plaintext tokens are never written to disk, database, or logs.

### 2.2 Startup Configuration Verification
- The API backend runs `validateStartupConfig()` before NestJS initialization.
- If `GITHUB_TOKEN_ENCRYPTION_KEY` is missing or not 64 hex characters, or `DATABASE_URL` is absent, the process exits immediately with a fatal error (`process.exit(1)`).

---

## 3. Session & Authentication Security

- **Session Tokens**: 256-bit cryptographically secure random hex strings (`crypto.randomBytes(32)`).
- **Cookie Policy**:
  - `HttpOnly: true` (inaccessible to JavaScript / XSS).
  - `SameSite: Lax` (CSRF mitigation).
  - `Secure: true` in production environments.
  - Opaque session tokens stored in PostgreSQL `Session` table with automatic TTL expiry.
- **Cross-User Ownership Isolation**:
  - Every project, environment, variable, deployment, and AI interaction requires `userId === req.user.id`.
  - Unauthorized access attempts return generic `404 Not Found` to prevent resource enumeration.

---

## 4. Network & API Hardening

- **HTTP Security Headers**: `helmet` enabled on all endpoints (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `X-XSS-Protection`).
- **Rate Limiting (Throttler)**:
  - Global limit: 60 requests per minute per IP.
  - Strict AI endpoints: 10 requests per minute per IP (`@Throttle`).
  - Webhook & Health check exemptions (`@SkipThrottle`).
- **CORS Policy**:
  - Production restricts `Access-Control-Allow-Origin` strictly to `process.env.FRONTEND_URL`.
- **Global Error Sanitization**:
  - `HttpExceptionFilter` and `AllExceptionsFilter` catch all exceptions.
  - Stack traces, file paths, database queries, and credentials are stripped from all API responses.

---

## 5. Container & Runtime Isolation

- **Docker Security Options**:
  - `--security-opt=no-new-privileges` prevents container privilege escalation.
  - `--pids-limit=100` prevents fork bombs.
  - `--memory=512m` and `--cpus=1.0` resource limits.
  - All host port bindings strictly bind to `127.0.0.1` (never `0.0.0.0`).
- **Log Sanitization**:
  - ANSI escape sequences are stripped (`/\x1B\[[0-9;]*[a-zA-Z]/g`).
  - GitHub Personal Access Tokens (`ghp_*`, `github_pat_*`), OAuth Bearer tokens, passwords, secrets, and temporary file paths are replaced with `[REDACTED_*]` placeholders.

---

## 6. AI Guardrails & Execution Boundaries

- **Tool Whitelist**: AI agents can only invoke read-only inspection tools (`inspectRepository`, `getRepositoryAnalysis`, `getDeployment`, `getDeploymentLogs`, etc.).
- **No Direct Shell Execution**: AI is structurally prohibited from executing shell commands or database mutations.
- **Bounded Agent Loop**: Hard ceiling of 5 iterations and 10 tool calls per agent request.
- **Timeout Protection**: All AI provider calls wrapped in `withAiTimeout()` with a 30-second ceiling and deterministic fallbacks.
- **Human Approval Requirement**: All AI repair suggestions require explicit user confirmation before any remediation action is applied.
