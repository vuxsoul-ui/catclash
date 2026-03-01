# CatClash Prod Deploy (CLI-only)

Canonical domain: `catclash.org`  
Vercel scope: `ks-projects-50fd40d7`

## 0) Sanity checks

```bash
vercel whoami
cat .vercel/project.json
vercel projects ls --scope ks-projects-50fd40d7
```

If `.vercel/project.json` is missing or wrong, run:

```bash
vercel link --scope ks-projects-50fd40d7
```

## 1) Deploy

```bash
npm run deploy:prod
```

## 2) Verify live build identity

```bash
npm run verify:prod
```

Then open:

- `https://catclash.org/api/build`
- `https://catclash.org/?debug=1`

Confirm the build stamp (`build`, `sha`, `at`) matches `/api/build`.

## 3) Optional local-vs-prod build check

After local build:

```bash
npm run build
npm run verify:diff
```

If mismatched, you will see:

`WARNING: Prod build != local build`
