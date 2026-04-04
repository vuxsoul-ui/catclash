# CatClash Workflow Playwright Suite

Default workflow smoke run:

```bash
npx playwright test tests/workflows --project=chromium
```

npm shortcut:

```bash
npm run test:e2e:workflows
```

## Seeded credential setup (recommended)

Set these before running authenticated workflows:

```bash
export CATCLASH_E2E_USERNAME="your_test_username"
export CATCLASH_E2E_PASSWORD="your_test_password"
```

Or place them in `.env.local`:

```env
CATCLASH_E2E_USERNAME=your_test_username
CATCLASH_E2E_PASSWORD=your_test_password
```

## Notes

- Workflows are mobile-first (`390x844`).
- Tournament workflows use fixture/debug paths for deterministic vote surfaces.
- If seeded creds are missing, helper bootstrap/cached creds are used when possible.
