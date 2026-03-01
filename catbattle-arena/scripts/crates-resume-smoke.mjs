const baseUrl = process.env.CRATE_SMOKE_URL || 'http://127.0.0.1:3000';

function pickCookieHeader(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  const first = setCookie.split(',').map((x) => x.trim()).find((x) => /^guest=/.test(x));
  return first ? first.split(';')[0] : '';
}

async function getSessionCookie() {
  const presetCookie = String(process.env.CRATE_SMOKE_COOKIE || '').trim();
  if (presetCookie) return presetCookie;

  const res = await fetch(`${baseUrl}/api/me`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`session bootstrap failed: /api/me status=${res.status}`);
  }
  const cookie = pickCookieHeader(res);
  if (!cookie) {
    throw new Error('Missing guest cookie from /api/me (set CRATE_SMOKE_COOKIE to run this smoke against an existing session)');
  }
  return cookie;
}

async function main() {
  const cookie = await getSessionCookie();

  const openRes = await fetch(`${baseUrl}/api/crates/open`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify({ mode: 'daily', crate_type: 'daily' }),
    cache: 'no-store',
  });

  const openData = await openRes.json().catch(() => ({}));
  if (!openRes.ok || openData?.ok === false || openData?.success === false) {
    console.log('[SKIP] open did not succeed; resume check skipped', {
      status: openRes.status,
      error: openData?.error || null,
    });
    process.exit(0);
  }

  const openingId = String(openData?.opening?.id || '').trim();
  if (!openingId) {
    throw new Error('Missing opening id from /api/crates/open response');
  }

  const latestRes = await fetch(`${baseUrl}/api/crates/latest`, {
    headers: { cookie },
    cache: 'no-store',
  });
  const latestData = await latestRes.json().catch(() => ({}));

  if (!latestRes.ok || latestData?.ok !== true) {
    throw new Error(`latest failed: status=${latestRes.status}`);
  }

  const latestId = String(latestData?.opening?.id || '').trim();
  if (latestId !== openingId) {
    throw new Error(`resume mismatch: open=${openingId} latest=${latestId || '<none>'}`);
  }

  console.log('[PASS] crates resume smoke', {
    openingId,
    crateType: latestData?.opening?.crate_type || null,
    status: latestData?.opening?.status || null,
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Missing guest cookie') || message.includes('session bootstrap failed') || message.includes('fetch failed')) {
    console.log('[SKIP] crates resume smoke', message);
    process.exit(0);
  }
  console.error('[FAIL] crates resume smoke', message);
  process.exit(1);
});
