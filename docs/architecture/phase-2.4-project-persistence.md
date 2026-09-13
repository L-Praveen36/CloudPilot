# CloudPilot Architecture — Phase 2.4: Project Persistence & Repository Connection

## 1. Overview

Phase 2.4 establishes the persistent project management layer in CloudPilot. It connects an authenticated user's GitHub repository to a persistent PostgreSQL `Project` entity through secure server-side repository verification, duplicate prevention, and strict user ownership isolation.

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (apps/web)                 │
│                                                             │
│  /dashboard (Control Plane)                                 │
│    ├── Segmented Tabs: Connected Projects | Repositories    │
│    ├── ProjectCard Grid & Disconnect Flow                   │
│    └── ConnectModal (Submits POST /projects)                │
│                                                             │
│  /projects/[id] (Project Details)                           │
│    ├── Project Metadata & Status (CONNECTED)                │
│    ├── Clone URLs (HTTPS & SSH copy snippets)               │
│    ├── Disconnect Confirmation Dialog                       │
│    └── Deployment Pipeline (Phase 2.5 Placeholder)          │
│                                                             │
│  lib/api.ts (Typed API Client with credentials: 'include')  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (with cloudpilot_session cookie)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    CloudPilot NestJS API                    │
│                                                             │
│  POST   /projects                                           │
│    ├── AuthGuard: Resolves UserDto from PostgreSQL session  │
│    ├── ValidationPipe: Validates owner, name, repo ID       │
│    ├── GitHubRepositoryService: Verifies GitHub access      │
│    ├── Duplicate check: (userId, githubRepositoryId) unique │
│    └── Prisma: Creates Project in PostgreSQL                │
│                                                             │
│  GET    /projects         (Lists user's projects only)      │
│  GET    /projects/:id     (Returns 404 if not owned/found)  │
│  DELETE /projects/:id     (Deletes project, returns 404)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                     │
│  - users (id, github_id, username, email, ...)              │
│  - github_accounts (user_id, access_token AES-256-GCM)      │
│  - sessions (session_token, user_id, expires_at)            │
│  - projects (id, user_id, github_repository_id, ...)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design

```prisma
enum ProjectStatus {
  CONNECTED
  DISCONNECTED
}

model Project {
  id                 String        @id @default(uuid())
  userId             String        @map("user_id")
  user               User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  githubRepositoryId Int           @map("github_repository_id")
  repositoryOwner    String        @map("repository_owner")
  repositoryName     String        @map("repository_name")
  repositoryFullName String        @map("repository_full_name")
  defaultBranch      String        @default("main") @map("default_branch")
  private            Boolean       @default(false)
  cloneUrl           String        @map("clone_url")
  htmlUrl            String        @map("html_url")
  status             ProjectStatus @default(CONNECTED)
  createdAt          DateTime      @default(now()) @map("created_at")
  updatedAt          DateTime      @updatedAt @map("updated_at")

  @@unique([userId, githubRepositoryId])
  @@index([userId])
  @@map("projects")
}
```

### Entity Relationships
- **User ↔ Projects**: One-to-Many with `onDelete: Cascade`. If a user account is deleted, associated projects are automatically removed.
- **Unique Constraint (`userId`, `githubRepositoryId`)**: Prevents the same user from creating multiple duplicate projects for the same repository. Distinct users can independently connect the same public repository.

---

## 4. Security & Isolation Model

1. **Zero Credential Exposure**:
   - The `Project` model never contains GitHub OAuth tokens, secrets, encryption keys, or passwords.
   - All repository authentication remains encapsulated within `GitHubAccount` and `CryptoService`.
2. **Server-Side GitHub Verification**:
   - When a project is created, the backend decrypts the user's GitHub token in memory and queries the GitHub API to verify repository accessibility and validate that the repository ID matches.
   - Malicious requests claiming repositories belonging to other users are rejected before database insertion.
3. **Session-Derived Ownership**:
   - Every project endpoint (`POST`, `GET`, `DELETE`) derives user ownership directly from the verified server-side session (`req.user.id`).
   - Client requests cannot specify or override the target `userId`.
4. **Cross-User Leakage Prevention**:
   - Querying or attempting to delete another user's project ID returns `404 Not Found` rather than `403 Forbidden` to prevent project ID enumeration.
5. **No Third-Party Repository Modification**:
   - Disconnecting a project deletes only the PostgreSQL record; the remote GitHub repository is never modified or deleted.

---

## 5. Explicit Phase 2.5 Boundary

Phase 2.4 strictly handles project persistence and management. The following capabilities are explicitly deferred to **Phase 2.5**:
- Git cloning and file tree extraction
- Dockerfile generation / container builds
- Multi-cloud deployment runners
- Real-time build/deployment logs & Redis job queues
- AI agent infrastructure orchestration
