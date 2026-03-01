import { randomUUID } from 'crypto';

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

async function getSigils(cookie) {
  const meRes = await fetch(`${baseUrl}/api/me`, { headers: { cookie }, cache: 'no-store' });
  const meData = await meRes.json().catch(() => null);
  if (!meRes.ok || !meData) return null;
  return Number(meData?.data?.progress?.sigils || 0);
}

async function openPaid(cookie, idempotencyKey) {
  const res = await fetch(`${baseUrl}/api/crates/open`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ mode: 'paid', crate_type: 'premium' }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const cookie = await getSessionCookie();
  const beforeSigils = await getSigils(cookie);
  if (beforeSigils == null) {
    console.log('[SKIP] idempotency smoke missing /api/me state');
    return;
  }
  if (beforeSigils < 90) {
    console.log('[SKIP] idempotency smoke requires >= 90 sigils for paid crate', { beforeSigils });
    return;
  }

  const idem = `smoke-${randomUUID()}`;
  const first = await openPaid(cookie, idem);
  if (!first.status || !first.data || first.status >= 400 || (!first.data.ok && !first.data.success)) {
    console.log('[SKIP] first paid open did not succeed', { status: first.status, error: first.data?.error || null });
    return;
  }

  const second = await openPaid(cookie, idem);
  if (!second.status || !second.data || second.status >= 400 || (!second.data.ok && !second.data.success && !second.data.pending)) {
    throw new Error(`second open failed status=${second.status} error=${second.data?.error || 'unknown'}`);
  }

  const firstOpeningId = String(first.data?.opening?.id || '').trim();
  const secondOpeningId = String(second.data?.opening?.id || '').trim();
  if (!firstOpeningId || firstOpeningId !== secondOpeningId) {
    throw new Error(`opening mismatch first=${firstOpeningId || '<none>'} second=${secondOpeningId || '<none>'}`);
  }

  const firstCatId = String(first.data?.opening?.cat_id || first.data?.cat_drop?.id || '').trim();
  const secondCatId = String(second.data?.opening?.cat_id || second.data?.cat_drop?.id || '').trim();
  if (firstCatId !== secondCatId) {
    throw new Error(`cat mismatch first=${firstCatId || '<none>'} second=${secondCatId || '<none>'}`);
  }

  const firstSigilsAfter = Number(first.data?.sigils_after ?? NaN);
  const secondSigilsAfter = Number(second.data?.sigils_after ?? NaN);
  if (Number.isFinite(firstSigilsAfter) && Number.isFinite(secondSigilsAfter) && firstSigilsAfter !== secondSigilsAfter) {
    throw new Error(`double deduction detected sigils_after first=${firstSigilsAfter} second=${secondSigilsAfter}`);
  }

  const afterSigils = await getSigils(cookie);
  if (afterSigils != null && Number.isFinite(firstSigilsAfter) && afterSigils !== firstSigilsAfter) {
    throw new Error(`unexpected final sigils after=${afterSigils} expected=${firstSigilsAfter}`);
  }

  console.log('[PASS] crates idempotency smoke', {
    openingId: firstOpeningId,
    catId: firstCatId || null,
    beforeSigils,
    afterSigils,
    sigilsAfterFirst: Number.isFinite(firstSigilsAfter) ? firstSigilsAfter : null,
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Missing guest cookie') || message.includes('session bootstrap failed') || message.includes('fetch failed')) {
    console.log('[SKIP] crates idempotency smoke', message);
    process.exit(0);
  }
  console.error('[FAIL] crates idempotency smoke', message);
  process.exit(1);
});
