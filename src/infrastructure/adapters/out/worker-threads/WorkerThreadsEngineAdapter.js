import { ScheduleEnginePort } from '../../../../application/ports/out/ScheduleEnginePort.js';
import { WorkerPool } from './WorkerPool.js';

export class WorkerThreadsEngineAdapter extends ScheduleEnginePort {
  constructor(pool = new WorkerPool()) {
    super();
    this.pool = pool;
  }

  async compute(config) {
    return await this.pool.submit(config);
  }

  getStats() {
    return this.pool.stats();
  }
}
