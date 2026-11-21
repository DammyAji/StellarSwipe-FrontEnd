# Contributing

Thanks for your interest in improving this project! This guide covers local setup, the database migration workflow, backend unit test conventions, database-backed integration tests, and how to get a change merged.

## Getting started

1. Fork the repository and create a feature branch off `main`.
2. Install dependencies for the backend and frontend as described in their respective `README` files.
3. Copy any example environment file to a local `.env` and fill in your own values. Never commit secrets.

### Frontend local setup

```bash
git clone https://github.com/AgesEmpire/StellarSwipe-FrontEnd.git
cd StellarSwipe-FrontEnd
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev                  # http://localhost:3000
```

Environment variables live in `.env.local` (git-ignored). `.env.example` documents every
supported variable — copy it and fill in only what you need. Never commit `.env.local` or any
secret; server-only values must not be prefixed with `NEXT_PUBLIC_`.

### Frontend commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (`next lint`) |
| `npm test` | Jest unit tests (`--no-coverage`) |
| `npm run test:coverage` | Jest with coverage |
| `npm run test:vitest` | Vitest suite |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:e2e:ui` | Playwright in UI mode |
| `npm run storybook` | Storybook dev server on port 6006 |
| `npm run build-storybook` | Static Storybook build |
| `npm run bundle:check` | Validate the build against the bundle budget |
| `npm run i18n:check` | Verify translation files are in sync |

Run `npm run lint`, `npm test` and `npm run test:e2e` before opening a pull request, plus
`npm run storybook` when you change a component that has stories.

### Branch naming and commits

- Branch off `main`; never commit directly to `main`.
- Name branches `<type>/<short-description>`, e.g. `feat/signal-feed-filters`,
  `fix/quote-refresh-race`, `docs/contributing-guide`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `<type>(<scope>): <summary>`, e.g. `fix(trade): clamp slippage to quote bounds`.
  Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Keep commits focused and the PR to one logical change.

### Pull request review process

1. Open the PR against `main` using the PR template and link the issue it closes.
2. Fill in the summary, the test plan, and the checklist (type-check, lint, tests, Storybook).
3. CI must be green: lint, unit tests, e2e, bundle budget and Lighthouse checks.
4. A maintainer reviews; address feedback with new commits (no force-push during review).
5. Once approved and green, a maintainer merges. Document any budget increase in the PR description.

## Database migrations

Schema changes are managed with **versioned, ordered migrations**. The application never alters the schema on startup — migrations are applied only through an explicit command, so production databases are never silently changed when the server boots.

### Layout

- Migrations live in `backend/migrations/` (or the backend's configured migrations directory).
- Each migration is a numbered SQL file, applied in ascending order:
  - `0001_create_users.sql`
  - `0002_add_orders_table.sql`
  - `0003_add_order_status_index.sql`
- Numbers are zero-padded and strictly increasing. Never renumber or edit a migration that has already been applied in any shared environment — add a new one instead.

### Tracking

Applied migrations are recorded in a `schema_migrations` table (version + applied timestamp). The migration runner reads this table to determine which migrations are pending, so re-running the command is safe and idempotent.

### Creating a migration

1. Pick the next number after the highest existing file.
2. Create `backend/migrations/<number>_<short_description>.sql` containing the forward-only SQL for the change.
3. Keep each migration focused on a single logical change.
4. Add a short comment at the top of the file describing the intent and any rollout notes.

### Running migrations

Migrations are run explicitly, never on application boot:

```
# apply all pending migrations
<backend> migrate up

# check which migrations are pending
<backend> migrate status
```

Run migrations as a dedicated deployment step (e.g. a release job) before starting the new application version. Do not wire migrations into the server startup path.

### Testing migrations

Every migration change should be covered by a test that provisions a clean database, runs all migrations from scratch, and asserts the resulting schema. This guarantees a fresh environment can be brought up to date and that migrations remain ordered and repeatable.

## Database-backed integration tests

Unit tests mock every dependency, so they cannot catch persistence bugs (constraints, cascades, transaction behavior). Integration tests exercise the real database against a **disposable, isolated** database so they never touch shared or production data.

### Isolated database per run

- Point integration tests at a dedicated test database via `TEST_DATABASE_URL` (never reuse the application's `DATABASE_URL`).
- Each run uses its own isolated schema/database so parallel runs and local development cannot collide. A common pattern is a per-run schema name (e.g. `test_<run-id>`) created at setup and dropped at teardown.
- The harness must refuse to run if the target looks like production (see the CI guard below).

### Migrations and cleanup

- Before the suite runs, apply **all** migrations from scratch against the disposable database so tests always start from the current schema.
- After the suite finishes, drop the isolated schema/database so no state leaks between runs.
- Wrap each test (or test file) in a transaction that is rolled back, or truncate the affected tables in `afterEach`, so tests are independent and order-insensitive.
- Teardown must run even when tests fail — register cleanup in `afterAll`/global teardown so a failed run does not leave a dangling database behind.

### Example: setup and teardown

```ts
import { Client } from 'pg';

const schema = `test_${process.pid}_${Date.now()}`;
let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await runMigrations(client); // apply all migrations from scratch
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
});
```

### CI safety guard

CI must never be able to target production settings:

- Integration tests read only `TEST_DATABASE_URL`; the workflow must not expose production `DATABASE_URL` or credentials to the test job.
- Add a guard that aborts the run if the resolved test URL matches a production host or is missing, so a misconfigured pipeline fails loudly instead of writing to real data.
- Keep test credentials scoped to the disposable database and rotate/expire them like any other secret.

## Backend unit tests (NestJS)

Providers and guards are tested in isolation with the Nest testing utilities. Tests must not require a live database, queue, or external service — every dependency is replaced with a mock.

### Conventions

- Place tests next to the code under test as `*.spec.ts` (e.g. `users.service.spec.ts`, `roles.guard.spec.ts`).
- Build the unit under test with `Test.createTestingModule({ providers: [...] })` and override its dependencies with `.overrideProvider(...).useValue(...)`.
- Use `jest.fn()` mocks for injected dependencies; assert on calls rather than hitting real services.
- Always `await module.close()` in `afterEach` so each test starts from a clean module.

### Example: isolated provider

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let module: TestingModule;
  let service: UsersService;
  const repository = { findById: jest.fn() };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('returns the user from the repository', async () => {
    repository.findById.mockResolvedValue({ id: '1' });
    await expect(service.findById('1')).resolves.toEqual({ id: '1' });
    expect(repository.findById).toHaveBeenCalledWith('1');
  });
});
```

### Example: isolated guard

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let module: TestingModule;
  let guard: RolesGuard;
  const reflector = { getAllAndOverride: jest.fn() };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();

    guard = module.get(RolesGuard);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: {} }) }), getHandler: () => ({}), getClass: () => ({}) } as any;
    expect(guard.canActivate(context)).toBe(true);
  });
});
```

## Submitting changes

- Keep pull requests focused; one logical change per PR.
- Match existing code style and structure; avoid unrelated refactors.
- Describe what changed and why, and note any migration or deployment steps reviewers must run.
- Make sure new migrations are documented and tested as described above.
- New providers and guards should ship with isolated unit tests following the conventions above.
- Persistence changes should be covered by a database-backed integration test using the disposable-database harness described above.
- Disclose any AI assistance in the PR description.
- Report security vulnerabilities privately per [SECURITY.md](SECURITY.md), never in a public issue.
