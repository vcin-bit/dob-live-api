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
