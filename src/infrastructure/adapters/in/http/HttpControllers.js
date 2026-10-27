import { sendJson, sendError, readJsonBody } from './HttpResponse.js';

export class HttpControllers {
  constructor({ academicDataUseCase, generateScheduleUseCase, convergenceGraphUseCase, healthMetricsUseCase }) {
    this.academicDataUseCase = academicDataUseCase;
    this.generateScheduleUseCase = generateScheduleUseCase;
    this.convergenceGraphUseCase = convergenceGraphUseCase;
    this.healthMetricsUseCase = healthMetricsUseCase;
  }

  async getSubjects(req, res) {
    const subjects = await this.academicDataUseCase.getSubjects();
    sendJson(res, 200, subjects);
  }

  async saveSubjects(req, res) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendError(res, 400, 'Invalid JSON body');
    }
    try {
      const result = await this.academicDataUseCase.saveSubjects(body);
      sendJson(res, 201, result);
    } catch (err) {
      sendError(res, 400, err.message);
    }
  }

  async getProfessors(req, res) {
    const professors = await this.academicDataUseCase.getProfessors();
    sendJson(res, 200, professors);
  }

  async saveProfessors(req, res) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendError(res, 400, 'Invalid JSON body');
    }
    try {
      const result = await this.academicDataUseCase.saveProfessors(body);
      sendJson(res, 201, result);
    } catch (err) {
      sendError(res, 400, err.message);
    }
  }

  async getGroups(req, res) {
    const groups = await this.academicDataUseCase.getGroups();
    sendJson(res, 200, groups);
  }

  async saveGroups(req, res) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendError(res, 400, 'Invalid JSON body');
    }
    try {
      const result = await this.academicDataUseCase.saveGroups(body);
      sendJson(res, 201, result);
    } catch (err) {
      sendError(res, 400, err.message);
    }
  }

  async generateSchedule(req, res) {
    const clientKey = req.socket.remoteAddress + ':' + (req.headers['x-forwarded-for'] || 'local');
    let overrides = {};
    try {
      overrides = await readJsonBody(req);
    } catch {
      return sendError(res, 400, 'Invalid JSON body');
    }

    const outcome = await this.generateScheduleUseCase.execute(clientKey, overrides);
    if (outcome.status === 429) {
      return sendError(res, 429, outcome.error, { 'X-RateLimit-Remaining': '0' });
    }
    if (outcome.status >= 400) {
      return sendError(res, outcome.status, outcome.error, {
        'X-RateLimit-Remaining': String(outcome.remaining ?? 30),
      });
    }

    sendJson(res, outcome.status, outcome.data, {
      'X-Cache': outcome.cacheStatus,
      'X-RateLimit-Remaining': String(outcome.remaining),
    });
  }

  async getConvergenceGraph(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const dataParam = url.searchParams.get('data');

    let customData = null;
    if (dataParam) {
      try {
        customData = JSON.parse(decodeURIComponent(dataParam));
      } catch {
        return sendError(res, 400, 'Invalid data param');
      }
    }

    try {
      await this.convergenceGraphUseCase.execute(req, res, customData);
    } catch (err) {
      if (err.message === 'NO_SCHEDULE_GENERATED') {
        return sendError(res, 400, 'No schedule has been generated yet. Please generate a schedule first via POST /api/schedules/generate');
      }
      sendError(res, 500, err.message);
    }
  }

  getHealth(req, res) {
    const snapshot = this.healthMetricsUseCase.execute();
    sendJson(res, 200, snapshot);
  }
}
