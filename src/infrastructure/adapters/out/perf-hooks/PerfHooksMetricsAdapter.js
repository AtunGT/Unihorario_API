import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { MetricsPort } from '../../../../application/ports/out/MetricsPort.js';

export class PerfHooksMetricsAdapter extends MetricsPort {
  constructor(maxSamples = 1000) {
    super();
    this.maxSamples = maxSamples;
    this.latencies = {
      '/api/schedules/generate': [],
      '/api/convergence': [],
      '/health': [],
      _all: [],
    };
    this.requestCount = 0;
    this.startTime = Date.now();
  }

  _recordLatency(route, ms) {
    const bucket = this.latencies[route] ?? (this.latencies[route] = []);
    bucket.push(ms);
    if (bucket.length > this.maxSamples) bucket.shift();
    this.latencies._all.push(ms);
    if (this.latencies._all.length > this.maxSamples * 3) this.latencies._all.shift();
  }

  _percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
  }

  _buildPercentiles(arr) {
    return {
      p50: this._percentile(arr, 50),
      p95: this._percentile(arr, 95),
      p99: this._percentile(arr, 99),
    };
  }

  startTimer(route) {
    const t0 = performance.now();
    return () => {
      const ms = performance.now() - t0;
      this._recordLatency(route, ms);
    };
  }

  recordRequest(url) {
    this.requestCount++;
  }

  snapshot(poolStats) {
    const uptime = (Date.now() - this.startTime) / 1000;
    const perRoute = {};
    for (const [route, arr] of Object.entries(this.latencies)) {
      if (route === '_all') continue;
      perRoute[route] = this._buildPercentiles(arr);
    }
    return {
      status: 'ok',
      pid: process.pid,
      uptime_s: Math.round(uptime),
      requests_total: this.requestCount,
      latency_ms: this._buildPercentiles(this.latencies._all),
      latency_by_route: perRoute,
      pool: poolStats,
    };
  }
}
