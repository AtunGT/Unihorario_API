import { CachePort } from '../../../../application/ports/out/CachePort.js';

export class ClusterIpcCacheAdapter extends CachePort {
  constructor(ipcClient) {
    super();
    this.ipc = ipcClient;
  }

  async get(key) {
    const res = await this.ipc.request({ type: 'CACHE_GET', key });
    return res.value ?? null;
  }

  async set(key, value) {
    this.ipc.sendAsync({ type: 'CACHE_SET', key, value });
  }
}
