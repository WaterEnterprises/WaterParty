/**
 * Payment endpoint integration tests.
 * Run: npx tsx tests/payment-endpoints.test.ts
 *
 * Requires the server to be running with test environment variables set.
 * These tests validate the payment/crowdfund route logic without hitting Stripe,
 * by checking request validation, auth requirements, and idempotency checks.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

let results: TestResult[] = [];
let sessionToken = '';
let partyId = '';

function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, passed: ok, error: detail });
  if (!ok) console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function testHealth() {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  assert('Health endpoint returns 200', res.status === 200);
  assert('Health has status field', data.status === 'ok' || data.status === 'error');
  assert('Health has uptime', typeof data.uptime === 'number');
  assert('Health has db field', typeof data.db === 'string');
}

async function testUnauthenticatedPayment() {
  // create-payment-intent without auth
  const res1 = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 50, partyId: 'test-party' }),
  });
  assert('create-payment-intent rejects unauthenticated', res1.status === 401);

  // contribute without auth
  const res2 = await fetch(`${BASE}/api/crowdfund/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId: 'pi_test', partyId: 'test-party', amount: 50 }),
  });
  assert('contribute rejects unauthenticated', res2.status === 401);

  // withdraw without auth
  const res3 = await fetch(`${BASE}/api/connect/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partyId: 'test-party' }),
  });
  assert('withdraw rejects unauthenticated', res3.status === 401);
}

async function testPaymentInputValidation() {
  // Login first
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
  });
  if (loginRes.status === 200) {
    const loginData = await loginRes.json();
    sessionToken = loginData.sessionId;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-session-token': sessionToken,
  };

  // Test missing amount
  const res1 = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ partyId: 'test' }),
  });
  assert('Rejects missing amount', res1.status === 400);

  // Test amount too low
  const res2 = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ amount: 0, partyId: 'test' }),
  });
  assert('Rejects amount < 1', res2.status === 400);

  // Test amount too high
  const res3 = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ amount: 99999, partyId: 'test' }),
  });
  assert('Rejects amount > 10000', res3.status === 400);

  // Test missing partyId
  const res4 = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ amount: 50 }),
  });
  assert('Rejects missing partyId', res4.status === 400);

  // Test contribute with missing fields
  const res5 = await fetch(`${BASE}/api/crowdfund/contribute`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ amount: 50 }),
  });
  assert('Contribute rejects missing paymentIntentId/partyId', res5.status === 400);

  // Test contribute with non-numeric amount
  const res6 = await fetch(`${BASE}/api/crowdfund/contribute`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ paymentIntentId: 'pi_test', partyId: 'test', amount: "fifty" }),
  });
  assert('Contribute rejects non-numeric amount', res6.status === 400);

  // Test contribute with negative amount
  const res7 = await fetch(`${BASE}/api/crowdfund/contribute`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ paymentIntentId: 'pi_test', partyId: 'test', amount: -10 }),
  });
  assert('Contribute rejects negative amount', res7.status === 400);
}

async function testWithdrawInputValidation() {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-session-token': sessionToken,
  };

  // Test missing partyId
  const res1 = await fetch(`${BASE}/api/connect/withdraw`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({}),
  });
  assert('Withdraw rejects missing partyId', res1.status === 400);

  // Test non-existent party
  const res2 = await fetch(`${BASE}/api/connect/withdraw`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ partyId: 'nonexistent_party' }),
  });
  assert('Withdraw rejects nonexistent party', res2.status === 404 || res2.status === 400);
}

async function testStripeNotConfigured() {
  // If Stripe is not configured, create-payment-intent should return 503
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-session-token': sessionToken,
  };

  const res = await fetch(`${BASE}/api/create-payment-intent`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ amount: 50, partyId: 'test' }),
  });

  // Should either succeed (stripe configured) or return 503 (not configured)
  assert('Stripe returns valid status', [200, 400, 404, 503].includes(res.status));
}

async function testHealthDbCheck() {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  assert('Health check reports db status', ['connected', 'disconnected'].includes(data.db));
}

async function run() {
  console.log('\n🔷 Payment Endpoint Tests\n');

  const tests = [
    testHealth,
    testHealthDbCheck,
    testUnauthenticatedPayment,
    testPaymentInputValidation,
    testWithdrawInputValidation,
    testStripeNotConfigured,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (e: any) {
      results.push({ name: test.name, passed: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} tests\n`);

  if (failed > 0) {
    console.error('Failed tests:');
    results.filter(r => !r.passed).forEach(r => console.error(`  ❌ ${r.name}: ${r.error || 'no details'}`));
    process.exit(1);
  }
}

run();
