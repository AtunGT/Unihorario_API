import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GraphRendererPort } from '../../../../application/ports/out/GraphRendererPort.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.resolve(__dirname, '../../../../../scripts/render_graph.py');

const GRAPH_TIMEOUT = parseInt(process.env.GRAPH_TIMEOUT || '15000', 10);
const MAX_OUTPUT_BYTES = parseInt(process.env.MAX_OUTPUT_BYTES || String(5 * 1024 * 1024), 10);

export class PythonGraphRendererAdapter extends GraphRendererPort {
  renderStream(req, res, histData) {
    return new Promise((resolve, reject) => {
      const args = [
        JSON.stringify(histData.best_hist || []),
        JSON.stringify(histData.avg_hist || []),
      ];

      const child = spawn('python', [PYTHON_SCRIPT, ...args], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let outputSize = 0;
      let headersSent = false;
      let timedOut = false;
      let resolved = false;

      const finish = (err) => {
        if (resolved) return;
        resolved = true;
        if (err) reject(err);
        else resolve();
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        if (!headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Graph render timed out', status: 504 }));
        } else {
          res.end();
        }
        finish(new Error('GRAPH_TIMEOUT'));
      }, GRAPH_TIMEOUT);

      req.on('close', () => {
        if (!resolved) {
          child.kill('SIGKILL');
          clearTimeout(timer);
          finish(new Error('CLIENT_DISCONNECTED'));
        }
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.stdout.on('data', (chunk) => {
        if (timedOut) return;
        outputSize += chunk.length;
        if (outputSize > MAX_OUTPUT_BYTES) {
          child.kill('SIGKILL');
          clearTimeout(timer);
          if (!headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Output size limit exceeded', status: 500 }));
          } else {
            res.end();
          }
          finish(new Error('OUTPUT_LIMIT_EXCEEDED'));
          return;
        }

        if (!headersSent) {
          headersSent = true;
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Transfer-Encoding': 'chunked',
          });
        }
        res.write(chunk);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut || resolved) return;
        if (code !== 0) {
          if (!headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Graph render failed', detail: stderr.slice(0, 500), status: 500 }));
          } else {
            res.end();
          }
          finish(new Error(`Python exited with code ${code}`));
          return;
        }
        if (headersSent) res.end();
        finish(null);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (!headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to spawn python process', status: 500 }));
        }
        finish(err);
      });
    });
  }
}
