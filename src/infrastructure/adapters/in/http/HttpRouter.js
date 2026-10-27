import { sendError } from './HttpResponse.js';

export class HttpRouter {
  constructor(controllers) {
    this.controllers = controllers;
    this.routes = [
      { method: 'GET',  pattern: /^\/api\/professors$/, handler: (req, res) => this.controllers.getProfessors(req, res) },
      { method: 'POST', pattern: /^\/api\/professors$/, handler: (req, res) => this.controllers.saveProfessors(req, res) },
      { method: 'GET',  pattern: /^\/api\/subjects$/, handler: (req, res) => this.controllers.getSubjects(req, res) },
      { method: 'POST', pattern: /^\/api\/subjects$/, handler: (req, res) => this.controllers.saveSubjects(req, res) },
      { method: 'GET',  pattern: /^\/api\/groups$/, handler: (req, res) => this.controllers.getGroups(req, res) },
      { method: 'POST', pattern: /^\/api\/groups$/, handler: (req, res) => this.controllers.saveGroups(req, res) },
      { method: 'POST', pattern: /^\/api\/schedules\/generate$/, handler: (req, res) => this.controllers.generateSchedule(req, res) },
      { method: 'GET',  pattern: /^\/api\/convergence$/, handler: (req, res) => this.controllers.getConvergenceGraph(req, res) },
      { method: 'GET',  pattern: /^\/health$/, handler: (req, res) => this.controllers.getHealth(req, res) },
    ];
  }

  handle(req, res) {
    const path = req.url.split('?')[0];
    for (const route of this.routes) {
      if (route.method === req.method && route.pattern.test(path)) {
        Promise.resolve(route.handler(req, res)).catch((err) => {
          sendError(res, 500, err.message);
        });
        return;
      }
    }
    sendError(res, 404, 'Not Found');
  }
}
