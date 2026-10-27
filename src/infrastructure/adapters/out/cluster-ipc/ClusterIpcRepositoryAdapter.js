import { AcademicRepositoryPort } from '../../../../application/ports/out/AcademicRepositoryPort.js';

export class ClusterIpcRepositoryAdapter extends AcademicRepositoryPort {
  constructor(ipcClient) {
    super();
    this.ipc = ipcClient;
  }

  async getEntities(entityName) {
    const res = await this.ipc.request({ type: 'STORE_GET', entity: entityName });
    return res.items || [];
  }

  async saveEntities(entityName, items) {
    await this.ipc.request({ type: 'STORE_ADD', entity: entityName, item: items });
    return { success: true, count: items.length };
  }

  async getAll() {
    const res = await this.ipc.request({ type: 'STORE_ALL' });
    return {
      subjects: res.subjects || [],
      professors: res.professors || [],
      groups: res.groups || [],
    };
  }

  async saveConvergenceHistory(history) {
    this.ipc.sendAsync({ type: 'STORE_CONVERGENCE', data: history });
  }

  async getConvergenceHistory() {
    const res = await this.ipc.request({ type: 'STORE_GET_CONVERGENCE' });
    return res.data || null;
  }
}
