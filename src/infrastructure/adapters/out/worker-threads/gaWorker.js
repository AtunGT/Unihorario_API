import { workerData, parentPort } from 'node:worker_threads';
import { runGA } from '../../../../domain/services/GeneticAlgorithm.js';

const bestFitnessAtom = new Float64Array(workerData.sharedBuffer);

parentPort.on('message', (config) => {
  try {
    const result = runGA(config, (newBest) => {
      if (newBest > bestFitnessAtom[0]) {
        bestFitnessAtom[0] = newBest;
      }
    });
    parentPort.postMessage(result);
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
});
