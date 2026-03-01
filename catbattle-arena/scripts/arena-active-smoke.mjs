#!/usr/bin/env node

const base = process.env.ARENA_BASE_URL || 'http://localhost:3000';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) fail(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const active = await getJson('/api/tournament/active?debug=1');
  if (!active?.ok) fail('tournament active payload not ok');
  const arenaTypes = new Set((active?.arenas || []).map((a) => String(a?.type || '')));
  if (!arenaTypes.has('main') || !arenaTypes.has('rookie')) {
    fail('main/rookie arenas are not both active');
  }

  const mainPage = await getJson('/api/arena/pages?arena=main&tab=voting&page=0&fixture=1');
  const rookiePage = await getJson('/api/arena/pages?arena=rookie&tab=voting&page=0&fixture=1');
  if ((mainPage?.matches || []).length !== 4) fail('fixture main does not return 4 matches');
  if ((rookiePage?.matches || []).length !== 4) fail('fixture rookie does not return 4 matches');

  console.log('PASS: arena active + inventory checks passed');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
