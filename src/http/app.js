import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';
import { DomainError } from '../domain/errors.js';

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const MIME_TYPES = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new DomainError('BAD_JSON', 'Request body must contain valid JSON'); }
}

async function serveStatic(pathname, response) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { sendJson(response, 400, { error: { code: 'BAD_PATH', message: 'Invalid URL path' } }); return; }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const target = path.resolve(publicDirectory, relative);
  if (target !== publicDirectory && !target.startsWith(`${publicDirectory}${path.sep}`)) {
    sendJson(response, 403, { error: { code: 'FORBIDDEN', message: 'Path is outside the public directory' } });
    return;
  }
  try {
    const details = await stat(target);
    if (!details.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'content-type': MIME_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream' });
    response.end(await readFile(target));
  } catch {
    sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'File was not found' } });
  }
}

export function createApp({ router = createRouter() } = {}) {
  router.get('/health', () => ({ status: 'ok' }));
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const body = await readJsonBody(request);
      const route = router.match(request.method, url.pathname);
      if (route?.badPathEncoding) throw new DomainError('BAD_PATH', 'Invalid URL path encoding');
      if (route) {
        const result = await route.handler({ request, response, params: route.params, query: url.searchParams, body });
        if (!response.writableEnded) sendJson(response, 200, result ?? {});
        return;
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'API route was not found' } });
        return;
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        if (request.method === 'HEAD') {
          const headResponse = { writeHead: (...args) => response.writeHead(...args), end: () => response.end() };
          await serveStatic(url.pathname, headResponse);
        } else await serveStatic(url.pathname, response);
        return;
      }
      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route was not found' } });
    } catch (error) {
      const known = error instanceof DomainError;
      const status = error?.code === 'BAD_JSON' ? 400 : error?.code === 'INVALID_TRANSITION' || error?.code === 'VALIDATION' ? 400 : 500;
      sendJson(response, status, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Internal server error' } });
    }
  });
}
