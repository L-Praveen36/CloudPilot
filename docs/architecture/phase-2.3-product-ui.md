# CloudPilot Architecture — Phase 2.3: Product UI & Connect Flow

## 1. Overview

Phase 2.3 implements the developer-facing product UI for CloudPilot. It transforms the authenticated dashboard into a production-grade repository management platform where developers can explore their GitHub repositories, filter results, inspect branch structures, copy safe clone URLs, and initiate a repository connection flow.

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (apps/web)                 │
│                                                             │
│  /dashboard                                                 │
│    ├── DashboardHeader (identity, avatar, logout)           │
│    ├── RepositorySearch (client-side query filter, refresh) │
│    ├── RepositoryList (responsive 1/2/3-col card grid)      │
│    ├── RepositoryPagination (Previous / Page X / Next)      │
│    └── ConnectModal (Phase 2.3 connection confirmation)     │
│                                                             │
│  /repositories/[owner]/[repo]                               │
│    ├── RepoHeader & Stats (stars, forks, language, issues)  │
│    ├── Clone Information (HTTPS & SSH copy snippets)        │
│    ├── Branch Explorer & Pagination (commits, protection)   │
│    └── Connect CTA Action                                   │
│                                                             │
│  lib/api.ts (Typed API Client with credentials: 'include')  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (with cloudpilot_session cookie)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    CloudPilot NestJS API                    │
│  - GET  /auth/me                                            │
│  - POST /auth/logout                                        │
│  - GET  /github/repositories                                │
│  - GET  /github/repositories/:owner/:repo                   │
│  - GET  /github/repositories/:owner/:repo/branches          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. UI Components & User Experience

### 1. Dashboard (`/dashboard`)
- **Header**: Displays CloudPilot wordmark with console tag, authenticated GitHub avatar, user name, `@username`, and logout action.
- **Repository Cards**:
  - Displays repository name, public/private visibility badge, and fork tag.
  - Primary programming language with language color dot.
  - Star count, fork count, open issues count, and default branch badge.
  - Formatted relative timestamp (`Updated 2d ago`).
  - Action buttons: `[Details]` (navigates to `/repositories/[owner]/[repo]`) and `[Connect]` (opens Connect confirmation modal).
- **Search & Filtering**:
  - Instant client-side search across loaded repositories by name and description (case-insensitive).
  - Shows result count indicator (`Showing X of Y repositories`).
  - Rate-limit badge showing available GitHub API quota and reset schedule.
  - Refresh button with animated spinner.
- **Pagination**:
  - Responsive `[Previous]  Page X  [Next]` controls.
  - Disables previous on page 1 or when `hasPreviousPage === false`.
  - Disables next when `hasNextPage === false`.
- **Loading & Error Handling**:
  - Shimmering 6-card skeleton during data fetches.
  - Clear distinction between "No repositories on GitHub" and "No search matches for query".
  - Dedicated alert banners for session expiration (401), rate limits (429), and upstream outages (502).

### 2. Repository Details & Branch Explorer (`/repositories/[owner]/[repo]`)
- **Breadcrumbs**: `← Back to Repositories` for seamless navigation.
- **Header**: Repository full name, description, language, stars, forks, issues, default branch, and external link to GitHub.
- **Clone Information**:
  - HTTPS and SSH clone URLs with one-click copy feedback.
  - Contains only standard public URLs; zero embedded credentials.
- **Branch Explorer**:
  - Searchable list of repository branches.
  - Protected branch indicators and commit SHA preview snippets.
  - Branch pagination (`[Previous] Page X [Next]`).
- **Connect CTA**: Prominent `[Connect Repository]` action.

### 3. Connect Flow Modal & Temporary Selection State
- **Confirmation Modal**:
  - Displays target `owner/repo`, default branch, and visibility.
  - Explains that CloudPilot will use this repository for deployment pipelines in Phase 2.4.
  - Allows user to cancel or continue.
- **Temporary State**:
  - Clicking `[Continue]` activates a client-side selection banner (`Repository Selected: owner/repo`).
  - Explains that persistent project creation will be active in Phase 2.4.
  - **Zero database writes or project persistence** are executed in this phase.

---

## 4. Security & Privacy Guarantees

1. **Zero Credential Exposure**: The frontend never receives, stores, or requests OAuth access tokens, client secrets, database credentials, or encryption keys.
2. **Strict Cookie-Based Authentication**: The browser relies solely on the HTTP-only `cloudpilot_session` cookie. No tokens or user data are written to `localStorage`, `sessionStorage`, or `IndexedDB`.
3. **No Direct Third-Party Communication**: The frontend communicates strictly with the CloudPilot NestJS backend (`credentials: 'include'`). The client browser never contacts the GitHub API directly.
4. **Safe Clone URLs**: Clone URLs displayed in the UI are standard URLs without embedded credentials or access tokens.

---

## 5. Explicit Phase 2.4 Boundary

In strict accordance with project boundaries, Phase 2.3 does NOT implement:
- `Project` database model or Prisma migrations.
- Database persistence for connected repositories.
- Repository cloning or file system extraction.
- Docker build execution or deployment runners.
- AI deployment generation or telemetry collection.

Persistent project records and deployment workflows will be introduced in **Phase 2.4**.
