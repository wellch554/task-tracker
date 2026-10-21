# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Task Tracker

Small task tracker (add, complete, delete, filter) for learning Claude Code.

## Stack
- Frontend: React + Vite + TypeScript (in /web)
- Backend: Node + Express + TypeScript (in /api)
- Tests: Vitest + React Testing Library (unit/component), Playwright (e2e)

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- E2E: `npm run test:e2e`
- Lint/typecheck: `npm run lint` / `npm run typecheck`

## Rules
- Write tests first for new behavior; run `npm test` before saying work is done
- Keep commits small, one logical change each
- Work on feature branches, never commit directly to main
- No new dependencies without asking
