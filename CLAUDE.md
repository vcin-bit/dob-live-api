# DOBLive

Security ops SaaS. Node/Express API on Render, React/Vite frontend in `app/`, Supabase DB, Clerk auth.

## Rules

- Always read the full file before editing
- Run `npm run build` inside `app/` after every frontend change before committing
- Never reformat or tidy code you are not directly fixing
- Never touch files not related to the current task
- Commit messages must describe what was fixed, not what was done

## Testing

End-to-end tests live in `app/e2e/`. They use Playwright with mocked API responses so they run without real credentials.

Install Playwright browsers (first time only):

```bash
cd app && npx playwright install
```

Run all e2e tests:

```bash
cd app && npx playwright test
```

Run a single test file:

```bash
cd app && npx playwright test e2e/officer-flows.spec.js
```

Run with headed browser for debugging:

```bash
cd app && npx playwright test --headed
```

View the HTML report after a run:

```bash
cd app && npx playwright show-report
```

### API smoke tests

Smoke tests for the live Render API live in `tests/api.test.js`. They use Node's built-in test runner and fetch — no extra dependencies.

```bash
npm run test:api
```

### Database health checks

Checks for data integrity issues (ghost shifts, bad status casing, orphan logs) via the Supabase REST API. Requires `SUPABASE_ANON_KEY` env var.

```bash
SUPABASE_ANON_KEY=your_key npm run test:db
```

## Known Safari Issues

- Safari ITP (Intelligent Tracking Prevention) purges third-party cookies after 7 days of inactivity. Clerk's default domain (`clerk.doblive.co.uk`) is a different subdomain from `app.doblive.co.uk`, so Safari may treat its cookies as third-party and purge them.
- **Solution**: Set up a custom Clerk proxy domain at `clerk.doblive.co.uk` as a first-party domain — this is configured in the Clerk dashboard under Domains, not in code.
- Officers should add the app to their home screen as a PWA for best session persistence. The app has `apple-mobile-web-app-capable` and a manifest configured for standalone mode.
