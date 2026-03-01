# Figma Integration (CatClash)

Use this to pull design data from Figma into the codebase.

## 1) Set env vars in `.env.local`

```bash
FIGMA_API_TOKEN=your_figma_personal_access_token
FIGMA_FILE_KEY=your_file_key
# optional: restrict pull to specific node ids
FIGMA_NODE_IDS=12:34,56:78
```

## 2) Sync from Figma

```bash
npm run figma:sync
```

## 3) Generated outputs

- `/Users/charon/go/catbattle-arena/app/_lib/design/figma.raw.json`
- `/Users/charon/go/catbattle-arena/app/_lib/design/figma.tokens.json`
- `/Users/charon/go/catbattle-arena/app/_lib/design/figma.tokens.css`

## 4) Apply tokens to UI

Import once in app styles (optional):

```css
@import "./_lib/design/figma.tokens.css";
```

Then use variables:

```css
background: var(--figma-surface-primary);
color: var(--figma-text-primary);
```

## Notes

- Do not commit real Figma tokens.
- If token leaks, revoke and rotate immediately.
