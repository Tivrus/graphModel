/**
 * Ждёт Vite и запускает Electron.
 * Использование: node scripts/dev-electron.mjs
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = 5173;
const url = `http://127.0.0.1:${port}`;

function waitForServer(timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('Vite не поднялся вовремя'));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const vite = spawn('npm', ['run', 'dev', '--', '--strictPort', '--port', String(port)], {
  cwd: root,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env },
});

let electronProc = null;

const shutdown = () => {
  electronProc?.kill();
  vite.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await waitForServer();
  electronProc = spawn('npx', ['electron', '.'], {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url,
    },
  });
  electronProc.on('exit', (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
} catch (err) {
  console.error(err);
  vite.kill();
  process.exit(1);
}

vite.on('exit', (code) => {
  if (code && code !== 0) {
    electronProc?.kill();
    process.exit(code);
  }
});
