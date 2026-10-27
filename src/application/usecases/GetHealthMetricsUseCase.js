import { HealthMetricsPort } from '../ports/in/HealthMetricsPort.js';

export class GetHealthMetricsUseCase extends HealthMetricsPort {
  constructor({ scheduleEngine, metrics }) {
    super();
    this.scheduleEngine = scheduleEngine;
    this.metrics = metrics;
  }

  execute() {
    const stats = this.scheduleEngine.getStats();
    return this.metrics.snapshot(stats);
  }
}
