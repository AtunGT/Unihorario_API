import { ConvergenceGraphPort } from '../ports/in/ConvergenceGraphPort.js';

export class GetConvergenceGraphUseCase extends ConvergenceGraphPort {
  constructor({ academicRepository, graphRenderer, metrics }) {
    super();
    this.academicRepository = academicRepository;
    this.graphRenderer = graphRenderer;
    this.metrics = metrics;
  }

  async execute(req, res, customData = null) {
    let histData = customData;
    if (!histData) {
      const history = await this.academicRepository.getConvergenceHistory();
      if (!history || !history.best_hist || !history.best_hist.length) {
        throw new Error('NO_SCHEDULE_GENERATED');
      }
      histData = history;
    }

    const end = this.metrics.startTimer('/api/convergence');
    try {
      await this.graphRenderer.renderStream(req, res, histData);
    } finally {
      end();
    }
  }
}
