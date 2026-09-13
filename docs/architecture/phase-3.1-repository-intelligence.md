# CloudPilot Architecture — Phase 3.1: Repository Source Acquisition

## 1. Roadmap Context

The Master CloudPilot Roadmap defines Phase 3 as:

```text
Phase 3 — Repository Intelligence

3.1 — Repository Source Acquisition          ← (This Phase)
3.2 — Repository Analyzer                    ← (Existing Analyzer Foundation)
3.3 — Application Structure Detection
3.4 — Deployment Readiness Report
```

---

## 2. Overview & Objective

Phase 3.1 implements the **Repository Source Acquisition** layer for CloudPilot. It securely retrieves the complete source code of a connected GitHub project into an isolated, unpredictable temporary workspace on disk, provides controlled read-only access for repository intelligence consumers, and guarantees workspace destruction on both success and failure.

---

## 3. Architecture & Data Flow

```text
CloudPilot Project (PostgreSQL)
        ↓
Ownership Validation (project.userId === authenticatedUser.id)
        ↓
Decrypt GitHub OAuth Token (in-memory only, AES-256-GCM)
        ↓
Pre-Acquisition Size Check (MAX_REPO_SIZE_MB guard)
        ↓
Create Temporary Isolated Workspace (os.tmpdir() / cp-src-<random32hex>)
        ↓
Download GitHub Tarball (Option A — authenticated HTTPS stream)
        ↓
Streaming Tar Extraction (spawn tar with argument array, no shell)
        ↓
Controlled Read-Only Consumer (RepositorySourceContext)
        ↓
Guaranteed Cleanup in finally (rm -rf workspace)
```

---

## 4. Source Acquisition Method: Option A — GitHub Tarball Stream

### Selected Method:
GitHub Archive API (`GET /repos/:owner/:repo/tarball/:branch`) streamed into `tar -x -z -C <workspace> --strip-components=1` via `child_process.spawn`.

### Security Rationale:
1. **Zero CLI Credential Exposure**: Unlike `git clone https://<token>@github.com/...`, the OAuth token is passed strictly in an in-memory HTTP `Authorization: Bearer <token>` header. It is never exposed in process listings (`ps aux` / `/proc`).
2. **No Shell Execution**: `tar` is invoked with an explicit argument array (`shell: false`), completely eliminating shell-injection vectors.
3. **History-Free Archive**: GitHub tarballs do not include `.git` directories or historical commit objects, reducing disk footprint and preventing unintended credential extraction from git commit logs.
4. **Immediate Credential Garbage Collection**: The decrypted token goes out of scope immediately after the HTTPS request is dispatched.

---

## 5. Temporary Workspace Lifecycle & Security

1. **Location**: Always allocated under the operating system temporary directory (`os.tmpdir()`), completely isolated and outside the permanent CloudPilot repository tree.
2. **Unpredictability**: Workspace directory name is generated with 16 cryptographically random bytes (`cp-src-[0-9a-f]{32}`).
3. **Permissions**: Directory created with strict mode `0o700` (owner read/write/execute only).
4. **Lifecycle Pattern (`withRepositorySource`)**:
   ```typescript
   await sourceService.withRepositorySource(userId, projectId, async (context) => {
     // context.workspacePath is strictly backend-internal
     // context.repositoryFullName, branch, commitSha, fileCount
   });
   // Guaranteed cleanup in `finally` block — runs on success AND on unhandled errors
   ```
5. **No Filesystem Leakage**: `workspacePath` is never returned in API DTOs, logged to console, or stored in PostgreSQL.

---

## 6. Resource Limits & Protections

| Variable | Default | Purpose |
|:---|:---|:---|
| `MAX_REPO_SIZE_MB` | `50 MB` | Pre-flight size check and streaming byte limit |
| `MAX_FILE_COUNT` | `10,000` | Post-extraction entry count limit |
| `MAX_FILE_SIZE_MB` | `10 MB` | Individual file size threshold |
| `SOURCE_ACQUISITION_TIMEOUT_MS` | `60,000 ms` | Overall acquisition timeout |

All limits are configurable via environment variables without code modification.

---

## 7. Secret File & Execution Boundaries

1. **Zero Repository Code Execution**:
   - Strictly forbidden: `npm install`, `npm start`, `python`, `pip`, `docker build`, `docker run`, build scripts.
   - The workspace is used exclusively for read-only static file inspection.
2. **Secret File Protection**:
   - `.env`, `.env.production`, `.pem`, `.key`, `id_rsa` file contents are never read during acquisition, logged, or returned in API responses.
3. **Database Integrity**:
   - Zero database schema changes for source acquisition. No workspace paths, archive bytes, or source files are persisted to PostgreSQL.

---

## 8. Integration Seam with Phase 3.2 (Repository Analyzer)

```text
RepositorySourceService.withRepositorySource(userId, projectId, async (ctx) => {
    // Phase 3.2 can invoke the RepositoryAnalyzerService directly against
    // ctx.workspacePath on disk:
    // const analysis = await analyzerService.analyzeWorkspace(ctx.workspacePath);
})
```

The existing static analyzer in `RepositoryAnalyzerService` continues to operate on in-memory manifests and file lists, serving as the immediate foundation for Phase 3.2 disk-based inspection.

---

## 9. Strict Phase Boundary

Phase 3.1 is strictly **Repository Source Acquisition**.
The following remain strictly out of scope:
- Phase 3.2 / 3.3 / 3.4 expansion: runtime inference, port detection, readiness scoring
- Phase 4: Docker execution, container builds, CI/CD, deployment workers
- Phase 5+: Production monitoring, metrics, log streaming
- Phase 6: AI agents, autonomous repair

