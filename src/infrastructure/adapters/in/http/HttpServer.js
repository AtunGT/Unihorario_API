import { createServer } from 'node:http';

export class HttpServer {
  constructor(router, metrics, port = process.env.PORT || 3000) {
    this.router = router;
    this.metrics = metrics;
    this.port = port;
    this.server = null;
  }

  start() {
    this.server = createServer((req, res) => {
      this.metrics.recordRequest(req.url);
      this.router.handle(req, res);
    });
    this.server.listen(this.port, () => {});
    return this;
  }

  stop(callback) {
    if (this.server) {
      this.server.close(callback);
    } else if (callback) {
      callback();
    }
  }
}
