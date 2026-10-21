# Task Tracker — Architecture Plan

## Context
The repo is greenfield (only CLAUDE.md). We're building a small task tracker for learning Claude Code: add, complete, delete, and filter tasks. The stack is React + Vite + TS in `/web` and Express + TS in `/api`. Decisions confirmed with the user:
- **Persistence:** JSON file on disk
- **Task model:** id, title, completed, createdAt, plus **dueDate** and **priority**
- **Filter:** status (All / Active / Completed) **plus** a title text search
- **Repo:** npm workspaces

This document covers architecture only. No code gets written until it's approved.

---

## 1. Folder structure

```
task-tracker/
├─ package.json            # workspaces: ["shared","api","web"]; root scripts fan out
├─ tsconfig.base.json      # shared strict TS settings
├─ eslint.config.js        # one flat config for all workspaces
├─ playwright.config.ts    # e2e; webServer starts api + web
├─ e2e/
│  └─ tasks.spec.ts
├─ shared/                 # @task-tracker/shared — types + validation only
│  └─ src/
│     ├─ task.ts           # Task, Priority, CreateTaskInput, UpdateTaskInput
│     └─ validate.ts       # pure validators, used by api (and form hints in web)
├─ api/
│  └─ src/
│     ├─ index.ts          # reads PORT / TASKS_FILE env, calls createApp, listens
│     ├─ app.ts            # createApp({ repo }) → express app (no listen; testable)
│     ├─ routes/tasks.ts   # router; thin handlers → repo
│     ├─ repo/
│     │  ├─ TaskRepo.ts        # interface
│     │  └─ JsonFileTaskRepo.ts# file-backed implementation
│     └─ middleware/errors.ts  # validation/404/500 → JSON error shape
│     (tests colocated: *.test.ts)
└─ web/
   ├─ index.html, vite.config.ts   # dev proxy /api → http://localhost:3001
   └─ src/
      ├─ main.tsx, App.tsx
      ├─ api/client.ts             # fetch wrappers, typed with shared types
      ├─ hooks/useTasks.ts         # data + mutations
      ├─ lib/filterTasks.ts        # pure filter/search/sort
      └─ components/
         ├─ AddTaskForm.tsx
         ├─ TaskFilters.tsx
         ├─ TaskList.tsx
         └─ TaskItem.tsx
      (tests colocated: *.test.ts(x))
```

Data file: `api/data/tasks.json` by default, overridable with `TASKS_FILE`. The file is gitignored.

## 2. Data model & REST API

```ts
type Priority = 'low' | 'medium' | 'high';
interface Task {
  id: string;            // crypto.randomUUID()
  title: string;         // trimmed, 1–200 chars
  completed: boolean;
  priority: Priority;    // default 'medium'
  dueDate: string | null;// ISO date 'YYYY-MM-DD' or null
  createdAt: string;     // ISO timestamp, server-set
}
```

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/api/tasks` | — | 200 `Task[]` | — |
| POST | `/api/tasks` | `{title, priority?, dueDate?}` | 201 `Task` | 400 |
| PATCH | `/api/tasks/:id` | partial `{title?, completed?, priority?, dueDate?}` | 200 `Task` | 400, 404 |
| DELETE | `/api/tasks/:id` | — | 204 | 404 |

- Error shape: `{ error: { message, details? } }`.
- Unknown fields are rejected with 400. `id` and `createdAt` can't be changed.
- Filtering and search happen **client-side**. The list is small, which keeps the API simple and the UI instant. Query params can be added to GET later if needed.

**JSON file repo:**
- Load the file lazily. A missing file means an empty list.
- Writes are serialized through a promise queue, so concurrent requests can't clobber each other.
- Each write is atomic: write to `tasks.json.tmp`, then `rename`.
- Validation lives in `shared/validate.ts` as hand-written pure functions, so no new schema library is needed.

## 3. React components & state

- **`App`** owns `useTasks()` and the filter state, and composes the pieces below.
- **`useTasks()`** returns `{ tasks, loading, error, addTask, toggleTask, updateTask, deleteTask }`.
  - It fetches once on mount.
  - Mutations call the API, then patch local state with the server's response. They aren't optimistic, so errors stay simple.
  - Errors show in one banner.
- **Filter state** is held in `App` with `useState`:
  ```ts
  {
    status: 'all' | 'active' | 'completed';
    priority: 'all' | Priority;
    due: 'any' | 'overdue' | 'today' | 'week' | 'none';
    query: string;
  }
  ```
  - `overdue` means dueDate is before today and the task isn't completed.
  - `today` means dueDate is today.
  - `week` means dueDate falls within today through the next 6 days.
  - `none` means there's no dueDate.
  - Dates are compared as local `YYYY-MM-DD` strings.
- **`filterTasks(tasks, filter, today)`** is a pure function. `today` is injected so tests are deterministic. It:
  - applies all filters together (AND): status, priority, due-date bucket
  - does a case-insensitive title match
  - sorts incomplete tasks first, then by dueDate (nulls last), then by priority (high→low), then by createdAt
- **`AddTaskForm`** has a title input, a priority select, and a date input. It does client-side validation and clears itself on success.
- **`TaskFilters`** has status buttons with `aria-pressed`, a priority select, a due-date select, a search input, and a "Clear filters" button that shows when any filter is active.
- **`TaskList`** renders `TaskItem`s, or an empty state that differs between "no tasks" and "no matches".
- **`TaskItem`** has a checkbox (toggle), the title, a priority badge, and the due date with overdue styling. It also has a delete button and inline edit for title, priority, and due date, which goes through PATCH.

There's no global state library. Hooks plus props are enough at this size.

## 4. Test strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | `shared/validate.ts` (every rule and edge case); `web/lib/filterTasks.ts` (each filter alone, combined filters, due-bucket boundaries such as yesterday, today, today+6, today+7 and null, overdue excluding completed tasks, and sort order); `JsonFileTaskRepo` against a temp dir (missing file, CRUD, persistence across instances, concurrent writes) |
| API | Vitest + **supertest** | `createApp` with a temp-file repo: each endpoint's happy path, 400s for bad payloads, 404s, status codes, and the error shape |
| Component | Vitest + RTL + jsdom | `AddTaskForm` (submit and validation), `TaskFilters` (callbacks), `TaskItem` (toggle, delete, edit), `App` with a mocked `api/client` (load, add, filter, and search end to end in the DOM, plus the error banner) |
| E2E | Playwright | Real api + web with `TASKS_FILE` pointing at a fresh temp file. One golden path: add tasks with priority/due → complete one → filter Active/Completed → filter by priority and due date → search → delete → reload and see the data persisted |

Tests are written first for each slice, per CLAUDE.md.

## 5. Build order (small, committable slices on a feature branch)

1. **Workspace scaffold:** root package.json with workspaces, tsconfig.base, eslint, and the `test`/`lint`/`typecheck`/`dev` scripts. Empty `shared`, `api`, and `web` packages, each with a trivial passing test.
2. **Shared types + validators**, with unit tests.
3. **`JsonFileTaskRepo`**, with unit tests on a temp dir.
4. **API `GET` + `POST /api/tasks`**, with supertest tests and the error middleware.
5. **API `PATCH` + `DELETE`**, with tests.
6. **Web shell:** Vite + React app, vite proxy, `api/client.ts`, and `useTasks` load/list. Includes the `App` + `TaskList` component tests.
7. **`AddTaskForm`**, with component tests.
8. **`TaskItem` toggle + delete**, with tests.
9. **`filterTasks` + `TaskFilters`** (status + search + sort), with unit and component tests.
9b. **Priority + due-date filters**, added to `filterTasks` and `TaskFilters` with "Clear filters", with tests. This is its own commit.
10. **`TaskItem` inline edit** (title, priority, due date), with tests.
11. **Playwright setup + golden-path e2e.**
12. **Polish:** overdue styling, empty states, README run instructions.

Each slice is one commit. `npm test`, `npm run lint`, and `npm run typecheck` must be green before each commit.

## Dependencies needing approval (per "no new deps without asking")
- **Runtime:** `express`, `react`, `react-dom`
- **Dev:**
  - `typescript`, `tsx` (to run the api in dev), `vite`, `@vitejs/plugin-react`
  - `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
  - `supertest`, `@playwright/test`
  - `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`
  - `concurrently` (root `dev` runs both servers)
  - `@types/express`, `@types/supertest`, `@types/react`, `@types/react-dom`
- Most are implied by the stack in CLAUDE.md. The additions that aren't are **supertest**, **tsx**, and **concurrently**. Approving this plan approves this list.

## Verification
- `npm test`: all unit, API, and component suites pass.
- `npm run typecheck` and `npm run lint` come back clean.
- `npm run test:e2e`: the Playwright golden path passes.
- Manual check: run `npm run dev`, open the Vite URL, add, complete, filter, search, edit, and delete tasks, then restart the API and confirm the tasks are still in `api/data/tasks.json`.
