# AGENTS.md

## Project Overview

Next.js 16 app (App Router, React 19, TypeScript strict, Tailwind CSS 4) for uploading and replaying Augment AI conversation session JSON files with turn-by-turn playback.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm run test     # Vitest (single run)
npm run test:watch
```

## Architecture

- `src/app/` — Next.js pages and API routes (`/api/sessions`, `/api/sessions/upload`)
- `src/components/` — UI components (SessionList, SessionReplay, PlaybackControls, TurnCard, ToolCallPanel, MarkdownRenderer)
- `src/lib/parser/` — session JSON parsing and turn-grouping logic
- `src/lib/schema/` — TypeScript type definitions for session data
- `src/lib/session-context.tsx` — global React context for session state
- `sessions/` — uploaded session JSON files (gitignored, not committed)
- `specs/` — design specs (e.g., encryption-at-rest proposal)

## Key Conventions

- **TypeScript strict mode** — no `any`, no implicit returns
- **Turn grouping**: a turn = one user message + all subsequent tool calls and assistant responses up to the next user message
- Sessions are stored server-side as raw JSON under `/sessions/`; currently unencrypted (see `specs/encryption-at-rest.md`)
- Components are client components where interactivity is needed; keep data-fetching in server components or API routes
- Use Tailwind utility classes only — no custom CSS except `globals.css`

## Testing

Vitest is configured in `vitest.config.ts`. Place unit tests alongside source files or under `src/**/__tests__/`. Run `npm test` before committing logic changes.
