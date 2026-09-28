/**
 * iPDS v4.1.0 — Test Module: Rate Limiting Engine & Enterprise Headers
 *
 * Verifies that:
 * 1. Sliding window rate limiter enforces strict request limits.
 * 2. Proper RFC 6585 & IETF headers (X-RateLimit-*, RateLimit-*, Retry-After) are populated.
 * 3. 429 Too Many Requests response is returned with standard payload.
 * 4. getClientKey handles IPv4, IPv6 normalization, and composite user keys.
 * 5. Distinct users sharing the same NAT IP do not starve each other.
 * 6. Staging load test bypass functions correctly.
 */

import { createRateLimiter, getClientKey, RateLimiterStore } from '../../../src/server/middleware/rateLimiter.js';
import {
  setTestDurableClient,
  isDurableRateLimiterConfigured
} from '../../../src/server/services/durableRateLimiter.service.js';

function mockReq(options: {
  ip?: string;
  forwardedFor?: string;
  clientId?: string;
  userId?: string;
  headers?: Record<string, string>;
} = {}): any {
  const headers: Record<string, string> = { ...options.headers };
  if (options.forwardedFor) {
    headers['x-forwarded-for'] = options.forwardedFor;
  }
  if (options.clientId) {
    headers['x-client-id'] = options.clientId;
  }

  const ip = options.ip !== undefined ? options.ip : '192.168.1.50';
  return {
    ip,
    headers,
    socket: { remoteAddress: ip || '192.168.1.50' },
    user: options.userId ? { sub: options.userId, app_metadata: { operator_id: options.userId } } : undefined
  };
}

function mockRes(): any {
  const headers: Record<string, any> = {};
  let statusCode = 200;
  let jsonBody: any = null;

  return {
    statusCode,
    headers,
    setHeader(name: string, value: any) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
    getJson() {
      return jsonBody;
    }
  };
}

export async function runRateLimitingTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE: RATE LIMITING ENGINE & ENTERPRISE HEADERS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test RL.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test RL.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test RL.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // Isolate Supabase environment credentials so standard tests exercise pure in-memory contract
  const envKeys = [
    'SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];
  for (const k of envKeys) delete process.env[k];

  try {

  // 1. IP and Key Extraction Normalization
  {
    const req1 = mockReq({ ip: '::ffff:10.0.0.1' });
    const key1 = getClientKey(req1, 'test');
    assert(key1 === 'test:10.0.0.1', 'Normalizes IPv6 mapped IPv4 address cleanly', `got ${key1}`);

    const req2 = mockReq({ ip: '10.0.0.2', userId: 'usr_888' });
    const key2 = getClientKey(req2, 'auth');
    assert(key2 === 'auth:10.0.0.2:usr_888', 'Generates composite key combining IP and User ID', `got ${key2}`);

    const req3 = mockReq({ ip: '', forwardedFor: '203.0.113.195, 70.41.3.18' });
    const key3 = getClientKey(req3, 'general');
    assert(key3.includes('203.0.113.195'), 'Extracts client IP from x-forwarded-for header', `got ${key3}`);
  }

  // 2. Sliding Window Enforcement & RFC 6585 Headers
  {
    const staticKey = `test_key_${Date.now()}`;
    const testLimiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 3,
      tierName: 'test_tier_' + Date.now(),
      keyGenerator: () => staticKey
    });

    let nextCount = 0;
    const next = () => { nextCount++; };

    // Request 1: Allowed (Remaining = 2)
    const res1 = mockRes();
    testLimiter(mockReq(), res1, next);
    assert(nextCount === 1, 'Request 1 under limit is allowed through');
    assert(res1.getHeader('x-ratelimit-remaining') === 2, 'X-RateLimit-Remaining decrements to 2');
    assert(res1.getHeader('ratelimit-remaining') === 2, 'RateLimit-Remaining header is set');

    // Request 2: Allowed (Remaining = 1)
    const res2 = mockRes();
    testLimiter(mockReq(), res2, next);
    assert(nextCount === 2, 'Request 2 under limit is allowed through');
    assert(res2.getHeader('x-ratelimit-remaining') === 1, 'X-RateLimit-Remaining decrements to 1');

    // Request 3: Allowed (Remaining = 0)
    const res3 = mockRes();
    testLimiter(mockReq(), res3, next);
    assert(nextCount === 3, 'Request 3 at limit is allowed through');
    assert(res3.getHeader('x-ratelimit-remaining') === 0, 'X-RateLimit-Remaining reaches 0');

    // Request 4: BLOCKED with 429
    const res4 = mockRes();
    testLimiter(mockReq(), res4, next);
    assert(nextCount === 3, 'Request 4 exceeding limit is NOT allowed through');
    assert(res4.statusCode === 429, 'Exceeded limit returns HTTP 429 Too Many Requests', `got ${res4.statusCode}`);
    assert(res4.getHeader('retry-after') >= 1, 'Retry-After header is provided in seconds');
    assert(res4.getJson()?.code === 'RATE_LIMITED', 'Standard RATE_LIMITED error code returned in body');
  }

  // 3. User Partitioning under same NAT IP
  {
    const natLimiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 2,
      tierName: 'nat_tier_' + Date.now()
    });

    let userACount = 0;
    let userBCount = 0;

    const reqUserA = mockReq({ ip: '192.168.10.100', userId: 'user_A' });
    const reqUserB = mockReq({ ip: '192.168.10.100', userId: 'user_B' });

    // User A consumes 2 requests
    natLimiter(reqUserA, mockRes(), () => { userACount++; });
    natLimiter(reqUserA, mockRes(), () => { userACount++; });
    const resABlocked = mockRes();
    natLimiter(reqUserA, resABlocked, () => { userACount++; });

    assert(userACount === 2, 'User A reaches their limit');
    assert(resABlocked.statusCode === 429, 'User A is rate limited on 3rd request');

    // User B on same IP can still make requests
    natLimiter(reqUserB, mockRes(), () => { userBCount++; });
    assert(userBCount === 1, 'User B on same IP is NOT blocked by User A consumption');
  }

  // 4. Staging load test bypass
  {
    const bypassLimiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 1,
      tierName: 'bypass_tier_' + Date.now(),
      keyGenerator: () => 'bypass_key'
    });

    let passedThrough = 0;
    const bypassReq = mockReq({ headers: { 'x-staging-load-test': 'ipds-benchmark-1500' } });

    bypassLimiter(bypassReq, mockRes(), () => { passedThrough++; });
    bypassLimiter(bypassReq, mockRes(), () => { passedThrough++; });
    bypassLimiter(bypassReq, mockRes(), () => { passedThrough++; });

    assert(passedThrough === 3, 'Authorized staging load-test header bypasses rate limiter for benchmark runs');
  }

  // 5. Cross-Instance Serverless State Sharing & Graceful Fallback
  {
    // (a) Two simulated serverless instances (separate RateLimiterStore instances)
    // sharing state through the durable store
    const sharedDb = new Map<string, { count: number; windowStart: number; tier: string }>();
    const mockDurableClient = {
      rpc: async (fn: string, args: any) => {
        const now = Date.now();
        let row = sharedDb.get(args.p_bucket_key);
        if (!row || now - row.windowStart >= args.p_window_ms) {
          row = { count: 1, windowStart: now, tier: args.p_tier };
        } else {
          row.count += 1;
        }
        sharedDb.set(args.p_bucket_key, row);
        const allowed = row.count <= args.p_limit;
        const remaining = Math.max(0, args.p_limit - row.count);
        const resetEpoch = Math.ceil((row.windowStart + args.p_window_ms) / 1000);
        const retryAfter = Math.max(1, Math.ceil((row.windowStart + args.p_window_ms - now) / 1000));
        return {
          data: {
            allowed,
            current_count: row.count,
            remaining,
            reset_time_epoch_sec: resetEpoch,
            retry_after_sec: retryAfter
          },
          error: null
        };
      }
    };

    setTestDurableClient(mockDurableClient);

    const storeInstance1 = new RateLimiterStore();
    const storeInstance2 = new RateLimiterStore();

    const sharedKey = `auth:cross_instance_ip_${Date.now()}`;
    const limiterInstance1 = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      tierName: 'auth_pin',
      store: storeInstance1,
      keyGenerator: () => sharedKey
    });

    const limiterInstance2 = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      tierName: 'auth_pin',
      store: storeInstance2,
      keyGenerator: () => sharedKey
    });

    let next1 = 0;
    let next2 = 0;

    // Instance 1: Request 1 (under limit)
    const resInst1 = mockRes();
    await limiterInstance1(mockReq(), resInst1, () => { next1++; });
    assert(next1 === 1, 'Instance 1: Request 1 is allowed through durable store');
    assert(resInst1.getHeader('x-ratelimit-remaining') === 1, 'Instance 1: X-RateLimit-Remaining decrements to 1');

    // Instance 2: Request 2 (should see Instance 1 count in durable store!)
    const resInst2 = mockRes();
    await limiterInstance2(mockReq(), resInst2, () => { next2++; });
    assert(next2 === 1, 'Instance 2: Request 2 is allowed through, seeing shared durable state');
    assert(resInst2.getHeader('x-ratelimit-remaining') === 0, 'Instance 2: Remaining reaches 0 based on shared count');

    // Instance 1: Request 3 (aggregate count = 3, exceeding limit of 2) -> BLOCKED
    const resInst1Blocked = mockRes();
    await limiterInstance1(mockReq(), resInst1Blocked, () => { next1++; });
    assert(next1 === 1, 'Instance 1: Request 3 is blocked by shared durable limit (not incremented)');
    assert(resInst1Blocked.statusCode === 429, 'Instance 1 returns HTTP 429 when aggregate durable limit is exceeded');

    // Instance 2: Request 4 (aggregate count = 4) -> ALSO BLOCKED
    const resInst2Blocked = mockRes();
    await limiterInstance2(mockReq(), resInst2Blocked, () => { next2++; });
    assert(next2 === 1, 'Instance 2: Request 4 is also blocked on separate serverless instance');
    assert(resInst2Blocked.statusCode === 429, 'Instance 2 returns HTTP 429 based on shared durable state');

    // (b) When durable store is unreachable, requests still get rate-limited via in-memory fallback
    const mockFailingClient = {
      rpc: async () => ({
        data: null,
        error: new Error('Postgres connection pool exhausted / network partition')
      })
    };
    setTestDurableClient(mockFailingClient);

    const fallbackStore = new RateLimiterStore();
    const fallbackKey = `ai:fallback_test_${Date.now()}`;
    const fallbackLimiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      tierName: 'ai_chat',
      store: fallbackStore,
      keyGenerator: () => fallbackKey
    });

    let fallbackNext = 0;
    const resFail1 = mockRes();
    await fallbackLimiter(mockReq(), resFail1, () => { fallbackNext++; });
    assert(fallbackNext === 1, 'Unreachable durable store: Request 1 succeeds via in-memory fallback');
    assert(resFail1.getHeader('x-ratelimit-remaining') === 1, 'Unreachable durable store: in-memory remaining is 1');

    const resFail2 = mockRes();
    await fallbackLimiter(mockReq(), resFail2, () => { fallbackNext++; });
    assert(fallbackNext === 2, 'Unreachable durable store: Request 2 succeeds via in-memory fallback');
    assert(resFail2.getHeader('x-ratelimit-remaining') === 0, 'Unreachable durable store: in-memory remaining is 0');

    // Request 3: Must be BLOCKED by the in-memory fallback (never allowed through unlimited!)
    const resFail3 = mockRes();
    await fallbackLimiter(mockReq(), resFail3, () => { fallbackNext++; });
    assert(fallbackNext === 2, 'Unreachable durable store: Request 3 is BLOCKED by in-memory fallback');
    assert(resFail3.statusCode === 429, 'Unreachable durable store: in-memory fallback returns 429 (no bypass)');

    // Reset test client override
    setTestDurableClient(null);
  }
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] !== undefined) {
        process.env[k] = savedEnv[k];
      }
    }
  }

  console.log(`MODULE RATE LIMITING RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

if (process.argv[1]?.endsWith('rate_limiting.test.ts') || process.argv[1]?.endsWith('rate_limiting.test.js')) {
  runRateLimitingTests().then((res) => {
    process.exit(res.passed === res.total ? 0 : 1);
  });
}
