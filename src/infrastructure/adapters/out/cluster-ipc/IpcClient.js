import process from 'node:process';

export class IpcClient {
  constructor() {
    this.pendingId = 0;
    this.pending = new Map();

    if (process.on) {
      process.on('message', (msg) => {
        if (!msg || !msg.id) return;
        const resolve = this.pending.get(msg.id);
        if (resolve) {
          this.pending.delete(msg.id);
          resolve(msg);
        }
      });
    }
  }

  request(payload, timeoutMs = 2000) {
    if (!process.send) {
      return Promise.resolve({ value: null, allowed: true, remaining: 999, items: [], success: true });
    }
    return new Promise((resolve, reject) => {
      const id = ++this.pendingId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('IPC timeout'));
      }, timeoutMs);

      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });

      process.send({ ...payload, id });
    });
  }

  sendAsync(payload) {
    if (process.send) {
      process.send(payload);
    }
  }
}
