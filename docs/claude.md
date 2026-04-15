# Claude Project Instructions

## Project Overview
This repository is for a new multi-platform Pencak Silat scoring system.

The platform will include:
- a Flutter judge app
- a web admin application
- a backend API
- a scoring engine for live match logic
- Stripe billing for subscriptions

This project replaces older codebases located in the `legacy/` folder.

## Important Folder Rules
- `legacy/tanding-scoring` and `legacy/silatscore` are reference-only.
- Do not build new production features inside `legacy/`.
- New production Flutter code goes in `apps/flutter_judge_app`.
- New production web code goes in `apps/web_admin_app`.
- New backend code goes in `services/api`.
- New live scoring logic goes in `services/scoring_engine`.
- New billing webhook code goes in `services/billing_webhooks`.
- Shared business rules go in `packages/shared_rules`.
- Shared TypeScript types go in `packages/shared_types`.

## Legacy Code Policy
Use legacy folders only to:
- understand old business logic
- inspect naming conventions
- reuse ideas selectively
- migrate useful code intentionally

Do not:
- continue old architecture patterns automatically
- rewrite in place inside legacy folders
- assume legacy database structure must be preserved exactly

## Core Business Rules
The application supports Pencak Silat match scoring.

### Judges
- 3 judges per arena
- judges use the Flutter app to submit punch and kick scores

### Dewan
- Dewan enters takedowns and penalties
- Dewan controls round timing and match flow

### Scoring Rules
- punch = 1 point
- kick = 2 points
- takedown = 3 points
- penalties = 1, 2, 5, 10, or disqualification
- punches and kicks only count if at least 2 of 3 judges submit the same action within 5 seconds
- takedowns and penalties are entered directly by Dewan
- all official scores must be decided server-side, not client-side

### Match Timing
- 3 rounds
- each round = 2 minutes
- break between rounds = 1 minute
- timer must be authoritative from backend or LAN host
- clients should display official timer state

## Architecture Goals
Build a clean new architecture with:
- Flutter for the judge app
- Next.js for the web admin app
- Node.js/TypeScript backend
- Firebase Auth for authentication
- Firestore for app data
- Stripe for subscriptions
- Cloud Run for backend deployment
- optional LAN/offline mode later for tournament venues with weak internet

## Development Priorities
Build in this order unless instructed otherwise:
1. shared rules and types
2. backend API scaffold
3. scoring engine scaffold
4. authentication flow
5. web admin app scaffold
6. Flutter judge app scaffold
7. billing integration
8. migration from legacy code as needed

## Coding Preferences
- prefer clear, modular code
- avoid overly clever abstractions
- keep business logic centralized
- use TypeScript for backend and web code
- make all scoring logic auditable
- preserve a clear event trail for official score decisions
- prefer server-side validation for anything security-critical

## When Making Changes
Before making major changes:
- explain what files will be created or updated
- keep changes scoped to the requested area
- do not rename major folders unless asked
- do not delete legacy code unless asked

## Output Expectations
When implementing features:
- state assumptions clearly
- create minimal but production-oriented structure
- include TODOs only when necessary
- prefer working scaffolds over placeholders