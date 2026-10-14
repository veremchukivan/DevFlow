# ADR 0001: Modular Monolith

## Status

Accepted

## Context

DevFlow starts as a learning product built by one developer, but it should be able to grow from MVP to production without a rewrite. The system needs clear module boundaries, tenant isolation, and room for realtime features, queues, billing, and automations later.

## Decision

Use a modular monolith with strict module boundaries. The API lives in one deployable backend, while domain modules expose public APIs and communicate through explicit calls or events.

## Consequences

- The first version stays simple to run, test, and deploy.
- Module boundaries are still designed intentionally from the beginning.
- Queues and workers can be added later without splitting into microservices too early.

