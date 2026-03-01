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
  const mainFixture = await getJson('/api/arena/pages?arena=main&tab=voting&page=0&fixture=1');
  const rookieFixture = await getJson('/api/arena/pages?arena=rookie&tab=voting&page=0&fixture=1');

  if (!mainFixture?.ok || (mainFixture?.matches || []).length !== 4) {
    fail('fixture main arena did not return 4 matches');
  }
  if (!rookieFixture?.ok || (rookieFixture?.matches || []).length !== 4) {
    fail('fixture rookie arena did not return 4 matches');
  }

  const lowEligibleProbe = await getJson('/api/arena/pages?arena=main&tab=voting&page=2&debug=1');
  if (!lowEligibleProbe?.ok) fail('low-eligible probe failed');
  if (!Array.isArray(lowEligibleProbe?.debug?.whyNotFilled)) {
    fail('debug reasons missing from low-eligible probe');
  }

  const lowCount = Number((lowEligibleProbe?.matches || []).length);
  if (lowCount < 4 && lowEligibleProbe?.debug?.whyNotFilled?.length === 0) {
    fail('partial inventory returned without debug reason');
  }

  console.log('PASS: arena inventory smoke checks passed');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
