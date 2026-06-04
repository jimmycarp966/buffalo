# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router routes and layouts (`(auth)`, `(dashboard)`, `(public)`, `api/`).
- `actions/`: Server Actions for business domains (`saleActions.ts`, `cashActions.ts`, etc.).
- `components/`: UI and feature components.
- `components/ui/` uses kebab-case primitives (`button.tsx`, `dropdown-menu.tsx`).
- `components/shared/` and feature components use PascalCase files (`CashRegisterView.tsx`).
- `lib/`, `hooks/`, `store/`, `types/`: shared logic, custom hooks, Zustand stores, and type definitions.
- `tests/`: `unit`, `integration`, `security`, `e2e`, plus `performance`, `responsive`, `accessibility`.
- `supabase/`: SQL schema/migration assets. `scripts/`: operational and maintenance scripts.

## Build, Test, and Development Commands
- `npm run dev`: start local dev server.
- `npm run dev:turbo`: dev server with Turbo mode.
- `npm run build` / `npm run start`: production build and runtime.
- `npm run lint`: ESLint (`next/core-web-vitals`).
- `npm run type-check`: TypeScript compile checks (`--noEmit`).
- `npm run test`: run Jest suites.
- `npm run test:unit`, `npm run test:integration`, `npm run test:security`: targeted suites.
- `npm run test:e2e`: Playwright end-to-end tests (`tests/e2e`).
- `npm run test:ci`: lint + type-check + core test pipeline before PR.

## Coding Style & Naming Conventions
- TypeScript-first with `strict: true`; use `@/*` import alias.
- Prettier is authoritative: 2 spaces, semicolons, double quotes, trailing commas (`es5`).
- Keep naming consistent:
- Hooks: `useXxx.ts` (example: `useRealtimeData.ts`).
- Actions: `*Actions.ts`.
- Shared/business React components: PascalCase.
- UI primitive files: kebab-case.

## Testing Guidelines
- Jest config targets `tests/unit`, `tests/integration`, and `tests/security`.
- Playwright covers browser flows in `tests/e2e/scenarios`.
- Test file suffixes in this repo include both `.test.ts(x)` and `.spec.ts`.
- Generate coverage with `npm run test:coverage` (output in `coverage/`).
- Run relevant focused suites locally, then `npm run test:ci` before opening/merging PRs.

## Commit & Pull Request Guidelines
- Follow observed commit style: Conventional Commit prefixes (`feat:`, `fix:`, `docs:`), optionally scoped (`feat(bot): ...`).
- Keep commits focused and include impacted module/context in the subject.
- PRs should include: concise summary, test evidence (commands run), and UI screenshots/videos for visual changes.
- Avoid `wip`/`draft` in ready PR titles (CodeRabbit ignores those titles for full review behavior).
- For DB changes, reference affected SQL files under `supabase/` or root SQL scripts.

## Security & Configuration Tips
- Never commit secrets or local env files (`.env`, `.env.local` are ignored).
- Keep certificates/keys out of git (`*.pem`, `certificados/` outputs).
- Validate environment configuration before running AFIP/printing scripts.
