# CloudPilot Architecture — Phase 2.2: GitHub Repository API Integration

## 1. Overview

Phase 2.2 implements the backend GitHub repository integration layer for CloudPilot. It enables authenticated users to securely retrieve their repositories, repository metadata, and branch lists directly from the GitHub REST API through the CloudPilot backend without ever exposing raw OAuth credentials to the client browser.

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 Client (Browser / Next.js)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS + cloudpilot_session (HTTP-only)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        NestJS API                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ AuthGuard (validates session in PostgreSQL)           │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ CurrentUser (UserDto)        │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ GitHubRepositoryController (validates query & params) │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ GitHubRepositoryService                               │  │
│  │  - Retrieves encrypted token from GitHubAccount       │  │
│  │  - Decrypts token in-memory via CryptoService         │  │
│  │  - Executes fetch with 10s AbortController timeout    │  │
│  │  - Parses Link-header pagination & RateLimit metadata │  │
│  │  - Maps raw response to safe CloudPilot DTOs          │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │ Authenticated HTTPS Request (Bearer token)
                               │ 10-second AbortController timeout
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       GitHub REST API                       │
│  - /user/repos                                              │
│  - /repos/{owner}/{repo}                                    │
│  - /repos/{owner}/{repo}/branches                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Endpoints & Request Contracts

All repository endpoints require an active `cloudpilot_session` cookie validated by `AuthGuard`.

### 1. `GET /github/repositories`
- **Query Parameters**:
  - `page` *(optional, integer, min 1, default 1)*: Page number.
  - `perPage` *(optional, integer, min 1, max 100, default 30)*: Results per page.
- **Example Request**:
  ```http
  GET /github/repositories?page=1&perPage=30 HTTP/1.1
  Host: localhost:3001
  Cookie: cloudpilot_session=a1b2c3d4e5f6...
  ```
- **Example Response**:
  ```json
  {
    "repositories": [
      {
        "id": 123456,
        "name": "cloudpilot-core",
        "fullName": "cloudpilot/cloudpilot-core",
        "description": "CloudPilot core orchestration engine",
        "htmlUrl": "https://github.com/cloudpilot/cloudpilot-core",
        "cloneUrl": "https://github.com/cloudpilot/cloudpilot-core.git",
        "sshUrl": "git@github.com:cloudpilot/cloudpilot-core.git",
        "defaultBranch": "main",
        "private": true,
        "fork": false,
        "language": "TypeScript",
        "stars": 42,
        "forks": 5,
        "openIssues": 2,
        "updatedAt": "2026-08-27T12:00:00Z",
        "pushedAt": "2026-08-27T12:30:00Z",
        "owner": {
          "login": "cloudpilot",
          "avatarUrl": "https://avatars.githubusercontent.com/u/99999"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 30,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "rateLimit": {
      "remaining": 4950,
      "resetAt": "2026-08-27T13:00:00.000Z"
    }
  }
  ```

### 2. `GET /github/repositories/:owner/:repo`
- **Path Parameters**:
  - `owner` *(string, regex validated)*: GitHub username or organization.
  - `repo` *(string, regex validated)*: Repository name.
- **Example Response**:
  ```json
  {
    "repository": {
      "id": 123456,
      "name": "cloudpilot-core",
      "fullName": "cloudpilot/cloudpilot-core",
      "description": "CloudPilot core orchestration engine",
      "htmlUrl": "https://github.com/cloudpilot/cloudpilot-core",
      "cloneUrl": "https://github.com/cloudpilot/cloudpilot-core.git",
      "sshUrl": "git@github.com:cloudpilot/cloudpilot-core.git",
      "defaultBranch": "main",
      "private": true,
      "fork": false,
      "language": "TypeScript",
      "stars": 42,
      "forks": 5,
      "openIssues": 2,
      "updatedAt": "2026-08-27T12:00:00Z",
      "pushedAt": "2026-08-27T12:30:00Z",
      "owner": {
        "login": "cloudpilot",
        "avatarUrl": "https://avatars.githubusercontent.com/u/99999"
      }
    },
    "rateLimit": {
      "remaining": 4949,
      "resetAt": "2026-08-27T13:00:00.000Z"
    }
  }
  ```

### 3. `GET /github/repositories/:owner/:repo/branches`
- **Path Parameters**: `owner`, `repo`
- **Query Parameters**: `page` *(default 1)*, `perPage` *(default 30, max 100)*
- **Example Response**:
  ```json
  {
    "branches": [
      {
        "name": "main",
        "sha": "abc123def4567890abcdef1234567890abcdef12",
        "protected": true
      },
      {
        "name": "staging",
        "sha": "fedcba0987654321fedcba0987654321fedcba09",
        "protected": false
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 30,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "rateLimit": {
      "remaining": 4948,
      "resetAt": "2026-08-27T13:00:00.000Z"
    }
  }
  ```

---

## 4. Security & Isolation Architecture

1. **In-Memory Decryption**:
   - `GitHubAccount.accessToken` is decrypted strictly in backend memory using `CryptoService` (AES-256-GCM) solely for the instant needed to dispatch the GitHub API request.
   - Decrypted tokens are never written to disk, never cached in Redis, never returned in DTOs, and never sent to the browser.
2. **User Isolation**:
   - Every request identifies the user strictly via the verified session cookie (`req.user.id`).
   - One user cannot query GitHub with another user's encrypted credentials.
3. **10-Second Request Timeout**:
   - Every outbound GitHub request is wrapped with `AbortController` and a 10,000ms timer.
   - Prevents backend thread starvation from slow or stalled upstream connections.
4. **Error Sanitization & HTTP Mapping**:
   - `401 Unauthorized` -> `401 Unauthorized` (`GitHub authentication token is invalid or has expired`)
   - `403 Forbidden` with rate limit exceeded -> `429 Too Many Requests`
   - `403 Forbidden` without rate limit -> `403 Forbidden`
   - `404 Not Found` -> `404 Not Found`
   - `5xx / Network Timeout / Malformed JSON` -> `502 Bad Gateway`
   - Zero access tokens, headers, or internal stack traces are included in error messages.
5. **Input Validation**:
   - `page` and `perPage` are strictly validated as positive integers with a maximum cap of 100.
   - `owner` and `repo` path parameters are validated via regex against injection or directory traversal patterns.
