import cluster from 'node:cluster';
import process from 'node:process';
import { ClusterPrimary } from './infrastructure/cluster/ClusterPrimary.js';
import { PerfHooksMetricsAdapter } from './infrastructure/adapters/out/perf-hooks/PerfHooksMetricsAdapter.js';
import { IpcClient } from './infrastructure/adapters/out/cluster-ipc/IpcClient.js';
import { ClusterIpcRepositoryAdapter } from './infrastructure/adapters/out/cluster-ipc/ClusterIpcRepositoryAdapter.js';
import { ClusterIpcCacheAdapter } from './infrastructure/adapters/out/cluster-ipc/ClusterIpcCacheAdapter.js';
import { ClusterIpcRateLimiterAdapter } from './infrastructure/adapters/out/cluster-ipc/ClusterIpcRateLimiterAdapter.js';
import { WorkerThreadsEngineAdapter } from './infrastructure/adapters/out/worker-threads/WorkerThreadsEngineAdapter.js';
import { PythonGraphRendererAdapter } from './infrastructure/adapters/out/child-process/PythonGraphRendererAdapter.js';
import { AcademicDataUseCase } from './application/usecases/AcademicDataUseCase.js';
import { GenerateScheduleUseCase } from './application/usecases/GenerateScheduleUseCase.js';
import { GetConvergenceGraphUseCase } from './application/usecases/GetConvergenceGraphUseCase.js';
import { GetHealthMetricsUseCase } from './application/usecases/GetHealthMetricsUseCase.js';
import { HttpControllers } from './infrastructure/adapters/in/http/HttpControllers.js';
import { HttpRouter } from './infrastructure/adapters/in/http/HttpRouter.js';
import { HttpServer } from './infrastructure/adapters/in/http/HttpServer.js';

if (cluster.isPrimary) {
  const primary = new ClusterPrimary();
  primary.start();
} else {
  const metrics = new PerfHooksMetricsAdapter();
  const ipcClient = new IpcClient();
  const academicRepository = new ClusterIpcRepositoryAdapter(ipcClient);
  const cache = new ClusterIpcCacheAdapter(ipcClient);
  const rateLimiter = new ClusterIpcRateLimiterAdapter(ipcClient);
  const scheduleEngine = new WorkerThreadsEngineAdapter();
  const graphRenderer = new PythonGraphRendererAdapter();

  const academicDataUseCase = new AcademicDataUseCase({ academicRepository });
  const generateScheduleUseCase = new GenerateScheduleUseCase({
    scheduleEngine,
    academicRepository,
    cache,
    rateLimiter,
    metrics,
  });
  const convergenceGraphUseCase = new GetConvergenceGraphUseCase({
    academicRepository,
    graphRenderer,
    metrics,
  });
  const healthMetricsUseCase = new GetHealthMetricsUseCase({
    scheduleEngine,
    metrics,
  });

  const controllers = new HttpControllers({
    academicDataUseCase,
    generateScheduleUseCase,
    convergenceGraphUseCase,
    healthMetricsUseCase,
  });

  const router = new HttpRouter(controllers);
  const server = new HttpServer(router, metrics);
  server.start();

  process.on('message', (msg) => {
    if (msg && msg.type === 'SHUTDOWN') {
      server.stop(() => process.exit(0));
    }
  });

  process.on('SIGTERM', () => {
    server.stop(() => process.exit(0));
  });
}
