# ADR-0003: Separate web app on Vite + TanStack Router/Query

**Status:** accepted · **Date:** 2026-10-17

## Context

The web app is the analysis and management tool (trends, settings, observers) with a different UX from mobile. SSR and SEO are not needed: the dashboard is behind a login, and the backend is separate.

## Decision

**Vite + React + TS**, **TanStack Router** (typed routes), **TanStack Query** (data logic shared with mobile). The static build is served by the same reverse proxy on Hetzner.

## Alternatives considered

- Next.js — duplicates the backend's role and complicates deployment without need.
- Expo Web sharing code with mobile — the compromise degrades both UXs.

## Consequences

- Simple deployment (static files).
- Hooks and API client shared with mobile.
  − Link previews for invitations in messengers — serve meta tags from the backend if needed.
