import { RateLimiterPort } from '../../../../application/ports/out/RateLimiterPort.js';

export class ClusterIpcRateLimiterAdapter extends RateLimiterPort {
  constructor(ipcClient) {
    super();
    this.ipc = ipcClient;
  }

  async check(clientKey) {
    const res = await this.ipc.request({ type: 'RATE_CHECK', clientKey });
    return {
      allowed: Boolean(res.allowed),
      remaining: typeof res.remaining === 'number' ? res.remaining : 30,
    };
  }
}
