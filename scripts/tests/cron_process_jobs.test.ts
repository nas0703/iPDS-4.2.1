import { runCronEndpointTests } from './modules/cron_endpoint.test.js';

async function main() {
  console.log('====================================================');
  console.log('iPDS VER 4.1.0 — VERCEL CRON (/api/cron/process-jobs) TEST SUITE');
  console.log('====================================================');

  const result = await runCronEndpointTests();

  console.log('\n====================================================');
  console.log(`CRON TEST SUITE SUMMARY: ${result.passed}/${result.total} PASSED`);
  console.log('====================================================\n');

  if (result.passed !== result.total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
