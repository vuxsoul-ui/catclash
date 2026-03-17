# Launch Runbook

## Production Health Checks

Use these commands for launch verification:

```bash
curl -fsS https://catclash.org/api/health
curl -i https://catclash.org/api/me
curl -fsS https://catclash.org/api/tournament/active
```

Expected signals:
- `health` returns `ok: true`
- database status returns `db: { ok: true }`
- tournament payload contains arenas and matches

## Edge Function Verification

Use this exact dry-run command for `resolve-pulse`:

```bash
curl -i -X POST \
https://zjskvepaefxhcesooaee.supabase.co/functions/v1/resolve-pulse \
-H "apikey: $APP_SERVICE_ROLE_KEY" \
-H "Authorization: Bearer $APP_SERVICE_ROLE_KEY" \
-H "Content-Type: application/json" \
-d '{"dry_run": true, "resolved_by": "admin"}'
```

Notes:
- use both `apikey` and `Authorization` headers
- keep `dry_run` set to `true` for verification
- never test with `{}` because that triggers a real pulse resolution

## Pulse System Monitoring

Operators should confirm:

### `pulses` table
- the last pulse is marked `resolved`
- the next pulse exists and is marked `pending`

### `match_history` table
- new rows are inserted after a pulse resolves

### `notifications` table
- owner notifications are created after pulse resolution

## Vote System Monitoring

Check:
- `votes_a` and `votes_b` are incrementing during active voting
- `percent_a + percent_b = 100`
- no API vote errors are appearing in logs
- arena advances to the next match after a vote is submitted

## Quick Rollback

If the latest deploy breaks production:

1. Revert the last deploy commit

```bash
git revert HEAD
```

2. Push the rollback

```bash
git push origin main
```

3. Redeploy

This restores the previous stable build through the normal deployment path.

## Known Safe Commands

Deploy `resolve-pulse` with:

```bash
supabase functions deploy resolve-pulse \
--project-ref zjskvepaefxhcesooaee \
--no-verify-jwt
```

This deploy flag must remain in place because `resolve-pulse` performs custom `apikey` validation inside the function.
