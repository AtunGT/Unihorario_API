import { GenerateSchedulePort } from '../ports/in/GenerateSchedulePort.js';

export class GenerateScheduleUseCase extends GenerateSchedulePort {
  constructor({ scheduleEngine, academicRepository, cache, rateLimiter, metrics }) {
    super();
    this.scheduleEngine = scheduleEngine;
    this.academicRepository = academicRepository;
    this.cache = cache;
    this.rateLimiter = rateLimiter;
    this.metrics = metrics;
  }

  async execute(clientKey, overrides = {}) {
    const rateResult = await this.rateLimiter.check(clientKey);
    if (!rateResult.allowed) {
      return { status: 429, remaining: 0, error: 'Rate limit exceeded' };
    }

    const store = await this.academicRepository.getAll();
    const subjects = store.subjects || [];
    const professors = store.professors || [];
    const groups = store.groups || [];

    if (!subjects.length) {
      return { status: 400, remaining: rateResult.remaining, error: 'No subjects registered in store. Add subjects first via POST /api/subjects' };
    }
    if (!professors.length) {
      return { status: 400, remaining: rateResult.remaining, error: 'No professors registered in store. Add professors first via POST /api/professors' };
    }
    if (!groups.length) {
      return { status: 400, remaining: rateResult.remaining, error: 'No groups registered in store. Add groups first via POST /api/groups' };
    }

    const config = {
      days: 5,
      slots: 8,
      pop_size: 100,
      generations: 300,
      mut_rate: 0.15,
      elite: 5,
      tourn_k: 3,
      ...overrides,
      subjects,
      professors,
      groups,
    };

    const cacheKey = JSON.stringify(config);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { status: 200, cacheStatus: 'HIT', remaining: rateResult.remaining, data: cached };
    }

    const end = this.metrics.startTimer('/api/schedules/generate');
    try {
      const result = await this.scheduleEngine.compute(config);
      end();
      await this.cache.set(cacheKey, result);
      await this.academicRepository.saveConvergenceHistory({
        best_hist: result.best_hist,
        avg_hist: result.avg_hist,
      });
      return { status: 200, cacheStatus: 'MISS', remaining: rateResult.remaining, data: result };
    } catch (err) {
      end();
      if (err.message === 'POOL_SATURATED') {
        return { status: 503, remaining: rateResult.remaining, error: 'Worker pool saturated' };
      }
      if (err.message === 'TASK_TIMEOUT') {
        return { status: 504, remaining: rateResult.remaining, error: 'Schedule generation timed out' };
      }
      return { status: 500, remaining: rateResult.remaining, error: err.message };
    }
  }
}
