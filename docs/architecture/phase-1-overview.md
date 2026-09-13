# CloudPilot Architecture - Phase 1 Foundation

## Overview

CloudPilot is an AI-powered cloud deployment and observability platform. Phase 1 establishes the foundational monorepo layout, shared package infrastructure, database & cache services, and basic health-check mechanisms.

## Repository Architecture

```
CloudPilot/
├── apps/
│   ├── web/                     # Next.js App Router (TypeScript, Tailwind CSS)
│   └── api/                     # NestJS Core API (TypeScript, Prisma ORM)
├── packages/
│   └── shared/                  # Shared domain types, DTOs, and constants
├── infrastructure/
│   └── docker/                  # Multi-stage Docker definitions for services
├── docs/
│   └── architecture/            # Architectural and design documentation
├── .env.example                 # Configuration template with placeholders
├── docker-compose.yml           # Local PostgreSQL and Redis orchestration
├── package.json                 # Monorepo workspaces definition
└── tsconfig.base.json           # Shared TypeScript base configuration
```

## Workspaces & Packages

- **`@cloudpilot/shared`**: Provides TypeScript interfaces across frontend and backend boundaries (e.g., `HealthCheckResponse`, `UserDto`).
- **`@cloudpilot/api`**: NestJS backend service exposing REST endpoints (including `/health`) and interfacing with PostgreSQL via Prisma.
- **`@cloudpilot/web`**: Next.js 15 frontend application rendering the UI and interacting with API services.

## Data & Infrastructure Layer

- **PostgreSQL 16**: Relational database for system metadata, user accounts, deployment states, and cluster configurations.
- **Redis 7**: High-speed distributed cache for sessions, job queues, and real-time state caching.
- **Prisma ORM**: Type-safe database client and schema migration tooling.

## Environment Variables

All configuration is externalized via environment variables (never committed to git). Refer to `.env.example` for all configurable keys.
