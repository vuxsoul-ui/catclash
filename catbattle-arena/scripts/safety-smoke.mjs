const base = process.env.SAFETY_BASE_URL || 'http://127.0.0.1:3000';
const adminSecret = String(process.env.ADMIN_SECRET || '').trim();

function log(name, ok, details = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${details ? ` - ${details}` : ''}`);
}

async function request(path, init = {}) {
  const res = await fetch(`${base}${path}`, init);
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function checkAdminGuards() {
  const unauth = await request('/api/admin/launch-metrics');
  log('admin unauthorized blocked', unauth.res.status === 401, `status=${unauth.res.status}`);

  if (!adminSecret) {
    console.log('[WARN] ADMIN_SECRET not set in env; skipping authorized admin check');
    return;
  }
  const auth = await request('/api/admin/launch-metrics', {
    headers: { Authorization: `Bearer ${adminSecret}` },
  });
  log('admin authorized reachable', auth.res.status !== 401, `status=${auth.res.status}`);
}

async function checkVoteRateLimit() {
  const matchId = String(process.env.SAFETY_VOTE_MATCH_ID || '').trim();
  const votedFor = String(process.env.SAFETY_VOTE_CAT_ID || '').trim();
  const cookie = String(process.env.SAFETY_COOKIE || '').trim();
  if (!matchId || !votedFor || !cookie) {
    console.log('[WARN] SAFETY_VOTE_MATCH_ID / SAFETY_VOTE_CAT_ID / SAFETY_COOKIE missing; skipping vote spam check');
    return;
  }

  let got429 = false;
  for (let i = 0; i < 12; i += 1) {
    const { res } = await request('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ match_id: matchId, voted_for: votedFor }),
    });
    if (res.status === 429) {
      got429 = true;
      break;
    }
  }
  log('vote spam throttled', got429, got429 ? '' : 'no 429 observed in 12 attempts');
}

async function checkSubmitRateLimit() {
  const cookie = String(process.env.SAFETY_COOKIE || '').trim();
  if (!cookie) {
    console.log('[WARN] SAFETY_COOKIE missing; skipping submit spam check');
    return;
  }

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgk0Q4kQAAAAASUVORK5CYII=',
    'base64'
  );

  let got429 = false;
  for (let i = 0; i < 4; i += 1) {
    const form = new FormData();
    form.set('name', `safety-${Date.now()}-${i}`);
    form.set('rarity', 'Common');
    form.set('attack', '40');
    form.set('defense', '40');
    form.set('speed', '40');
    form.set('charisma', '40');
    form.set('chaos', '40');
    form.set('power', 'None');
    form.set('description', 'safety smoke');
    form.set('image', new Blob([tinyPng], { type: 'image/png' }), 'safe.png');

    const res = await fetch(`${base}/api/cats/submit`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    });

    if (res.status === 429) {
      got429 = true;
      break;
    }
  }

  log('submit spam throttled', got429, got429 ? '' : 'no 429 observed in 4 attempts');
}

async function main() {
  console.log(`Safety smoke target: ${base}`);
  await checkAdminGuards();
  await checkVoteRateLimit();
  await checkSubmitRateLimit();
}

main().catch((err) => {
  console.error('safety smoke failed:', err);
  process.exit(1);
});
