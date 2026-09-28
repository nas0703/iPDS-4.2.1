/**
 * iPDS v3.8 — Automated Load & Stress Testing Script
 * Runs autocannon benchmark tests against local server endpoints.
 */

import autocannon from 'autocannon';

const BASE_URL = process.env.TEST_TARGET_URL || 'http://localhost:3000';

async function runBenchmark(name: string, opts: autocannon.Options) {
  console.log(`\n==================================================`);
  console.log(`🚀 MULAKAN UJIAN BEBAN (LOAD TEST): ${name}`);
  console.log(`🎯 Target URL: ${opts.url}`);
  console.log(`👥 Virtual Users (Connections): ${opts.connections}`);
  console.log(`⏱️ Tempoh Ujian: ${opts.duration} saat`);
  console.log(`==================================================\n`);

  return new Promise((resolve) => {
    const instance = autocannon(opts, (err, result) => {
      if (err || !result) {
        console.error(`❌ Ralat semasa ujian ${name}:`, err);
        return resolve(null);
      }

      console.log(`📊 HASIL UJIAN: ${name}`);
      console.log(`--------------------------------------------------`);
      console.log(`✅ Jumlah Request Diproses  : ${result.requests.total}`);
      console.log(`⚡ Purata Request/Saat (RPS) : ${result.requests.average.toFixed(2)} req/sec`);
      console.log(`⏱️ Latensi Purata (Latency)  : ${result.latency.average.toFixed(2)} ms`);
      console.log(`⏱️ Latensi Minima (p50)      : ${result.latency.p50} ms`);
      console.log(`⏱️ Latensi Maksima (p99)     : ${result.latency.p99} ms`);
      console.log(`💥 Jumlah Ralat (Non-2xx)    : ${result.non2xx}`);
      console.log(`--------------------------------------------------\n`);

      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log('\n==================================================');
  console.log('⚡ iPDS LOAD & STRESS TESTING SUITE ⚡');
  console.log('==================================================');

  // 1. Benchmark API Health & Baseline
  await runBenchmark('Baseline Health Check', {
    url: `${BASE_URL}/api/telemetry/health`,
    connections: 30,
    duration: 5
  });

  // 2. Benchmark Query API (Hasil & Cache Effectiveness)
  await runBenchmark('Hasil Query & Unified Cache Stress Test', {
    url: `${BASE_URL}/api/hasil/entries?estate_id=FPM_TUNGGAL`,
    connections: 30,
    duration: 5
  });

  // 3. Benchmark Background Job Enqueue Throttling
  await runBenchmark('Async Background Job Enqueue Stress Test', {
    url: `${BASE_URL}/api/jobs/submit`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'EXCEL_EXPORT', estate_id: 'FPM_TUNGGAL', payload: { test: true } }),
    connections: 20,
    duration: 5
  });

  console.log('\n==================================================');
  console.log('🎉 SEMUA UJIAN BEBAN SELESAI DENGAN JAYA!');
  console.log('==================================================\n');
}

main().catch(console.error);
