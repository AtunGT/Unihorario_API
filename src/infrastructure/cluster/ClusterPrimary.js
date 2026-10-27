import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

export class ClusterPrimary {
  constructor(workersCount = parseInt(process.env.WORKERS || os.cpus().length, 10)) {
    this.workersCount = workersCount;
    this.workerSet = new Set();
    this.scheduleCache = new Map();
    this.rateLimitStore = new Map();
    this.dataStore = {
      subjects: new Map(),
      professors: new Map(),
      groups: new Map(),
      latestConvergence: null,
    };
  }

  broadcast(msg) {
    for (const w of this.workerSet) {
      if (w.isDead && w.isDead()) continue;
      try {
        w.send(msg);
      } catch {}
    }
  }

  handleWorkerMessage(worker, msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'CACHE_GET') {
      const value = this.scheduleCache.get(msg.key) ?? null;
      try {
        worker.send({ type: 'CACHE_RESULT', id: msg.id, value });
      } catch {}
    }

    if (msg.type === 'CACHE_SET') {
      if (this.scheduleCache.size >= 500) {
        const firstKey = this.scheduleCache.keys().next().value;
        this.scheduleCache.delete(firstKey);
      }
      this.scheduleCache.set(msg.key, msg.value);
    }

    if (msg.type === 'RATE_CHECK') {
      const now = Date.now();
      const windowMs = 60_000;
      const limit = 30;
      const key = msg.clientKey;
      let entry = this.rateLimitStore.get(key);
      if (!entry || now - entry.start > windowMs) {
        entry = { start: now, count: 0 };
      }
      entry.count += 1;
      this.rateLimitStore.set(key, entry);
      const allowed = entry.count <= limit;
      const remaining = Math.max(0, limit - entry.count);
      try {
        worker.send({ type: 'RATE_RESULT', id: msg.id, allowed, remaining });
      } catch {}
    }

    if (msg.type === 'STORE_GET') {
      const items = Array.from(this.dataStore[msg.entity]?.values() || []);
      try {
        worker.send({ type: 'STORE_RESULT', id: msg.id, items });
      } catch {}
    }

    if (msg.type === 'STORE_ADD') {
      const list = Array.isArray(msg.item) ? msg.item : [msg.item];
      for (const it of list) {
        if (this.dataStore[msg.entity] && it && it.id) {
          this.dataStore[msg.entity].set(it.id, it);
        }
      }
      try {
        worker.send({ type: 'STORE_RESULT', id: msg.id, success: true, count: list.length });
      } catch {}
    }

    if (msg.type === 'STORE_ALL') {
      const subjects = Array.from(this.dataStore.subjects.values());
      const professors = Array.from(this.dataStore.professors.values());
      const groups = Array.from(this.dataStore.groups.values());
      try {
        worker.send({ type: 'STORE_RESULT', id: msg.id, subjects, professors, groups });
      } catch {}
    }

    if (msg.type === 'STORE_CONVERGENCE') {
      this.dataStore.latestConvergence = msg.data;
    }

    if (msg.type === 'STORE_GET_CONVERGENCE') {
      try {
        worker.send({ type: 'STORE_RESULT', id: msg.id, data: this.dataStore.latestConvergence });
      } catch {}
    }
  }

  start() {
    for (let i = 0; i < this.workersCount; i++) {
      const w = cluster.fork();
      this.workerSet.add(w);
      w.on('message', (msg) => this.handleWorkerMessage(w, msg));
    }

    cluster.on('exit', (worker, code, signal) => {
      this.workerSet.delete(worker);
      if (signal !== 'SIGTERM' && code !== 0) {
        const newWorker = cluster.fork();
        this.workerSet.add(newWorker);
        newWorker.on('message', (msg) => this.handleWorkerMessage(newWorker, msg));
      }
    });

    const graceful = () => {
      this.broadcast({ type: 'SHUTDOWN' });
      for (const w of this.workerSet) {
        try {
          w.process.kill('SIGTERM');
        } catch {}
      }
      setTimeout(() => process.exit(0), 5000).unref();
    };

    process.on('SIGTERM', graceful);
    process.on('SIGINT', graceful);
  }
}
