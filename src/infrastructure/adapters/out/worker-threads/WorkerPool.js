import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = path.join(__dirname, 'gaWorker.js');

const POOL_SIZE    = parseInt(process.env.POOL_SIZE || '4', 10);
const TASK_TIMEOUT = parseInt(process.env.TASK_TIMEOUT || '30000', 10);
const MAX_QUEUE    = parseInt(process.env.MAX_QUEUE || '50', 10);

const sharedBuffer = new SharedArrayBuffer(8);
const bestFitnessAtom = new Float64Array(sharedBuffer);
Atomics.store(new Int32Array(sharedBuffer), 0, 0);
bestFitnessAtom[0] = 0.0;

class PoolWorker {
  constructor() {
    this.busy = false;
    this.worker = null;
    this._spawn();
  }

  _spawn() {
    this.worker = new Worker(WORKER_SCRIPT, {
      workerData: { sharedBuffer },
    });
    this.worker.on('error', () => {
      this.busy = false;
      this._spawn();
    });
    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.busy = false;
        this._spawn();
      }
    });
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.busy = true;

      const timer = setTimeout(() => {
        this.worker.terminate();
        this.busy = false;
        reject(new Error('TASK_TIMEOUT'));
      }, TASK_TIMEOUT);

      this.worker.once('message', (result) => {
        clearTimeout(timer);
        this.busy = false;
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      });

      this.worker.once('error', (err) => {
        clearTimeout(timer);
        this.busy = false;
        reject(err);
      });

      this.worker.postMessage(task);
    });
  }
}

export class WorkerPool {
  constructor(size = POOL_SIZE, maxQueue = MAX_QUEUE) {
    this.size = size;
    this.maxQueue = maxQueue;
    this.pool = Array.from({ length: this.size }, () => new PoolWorker());
    this.taskQueue = [];
  }

  _getFreeWorker() {
    return this.pool.find(w => !w.busy) ?? null;
  }

  _dispatch() {
    if (!this.taskQueue.length) return;
    const worker = this._getFreeWorker();
    if (!worker) return;
    const { task, resolve, reject } = this.taskQueue.shift();
    worker.run(task)
      .then(resolve)
      .catch(reject)
      .finally(() => this._dispatch());
  }

  submit(task) {
    return new Promise((resolve, reject) => {
      const worker = this._getFreeWorker();
      if (worker) {
        worker.run(task)
          .then(resolve)
          .catch(reject)
          .finally(() => this._dispatch());
        return;
      }
      if (this.taskQueue.length >= this.maxQueue) {
        return reject(new Error('POOL_SATURATED'));
      }
      this.taskQueue.push({ task, resolve, reject });
    });
  }

  stats() {
    const busy = this.pool.filter(w => w.busy).length;
    return {
      size: this.size,
      busy,
      free: this.size - busy,
      queue_length: this.taskQueue.length,
      best_fitness_global: bestFitnessAtom[0],
    };
  }
}
