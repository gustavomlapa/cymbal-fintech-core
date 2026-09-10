const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  getPortalOverview,
  simulatePortalLoan,
  executePortalTransfer,
  evaluatePortalRisk
} = require('./portal_controller');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Health check endpoint
  if (pathname === '/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'UP',
      service: 'web-portal',
      version: '1.2.0',
      timestamp: new Date().toISOString()
    });
  }

  // Portal API Routes
  if (pathname === '/api/portal/overview' && method === 'GET') {
    const customerId = url.searchParams.get('customerId') || 'cust_001';
    const overview = await getPortalOverview(customerId);
    return sendJson(res, 200, overview);
  }

  if (pathname === '/api/portal/transfer' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = executePortalTransfer(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/portal/credit/simulate' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const simulation = simulatePortalLoan(body.amount, body.termMonths, body.annualRate);
      return sendJson(res, 200, simulation);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/portal/risk/evaluate' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const risk = evaluatePortalRisk(body);
      return sendJson(res, 200, risk);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/portal/services' && method === 'GET') {
    return sendJson(res, 200, {
      services: [
        { name: 'Core Banking API', port: 8081, lang: 'Go', health: '/health', status: 'ACTIVE' },
        { name: 'Identity & KYC API', port: 8082, lang: 'Node.js', health: '/health', status: 'ACTIVE' },
        { name: 'Payments & PIX API', port: 8083, lang: 'Python', health: '/health', status: 'ACTIVE' },
        { name: 'Credit & Loans API', port: 8084, lang: 'Node.js', health: '/health', status: 'ACTIVE' },
        { name: 'Risk & Fraud Engine', port: 8085, lang: 'Python', health: '/health', status: 'ACTIVE' }
      ]
    });
  }

  // Static file serving
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal on static files
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'INFO',
    service: 'web-portal',
    message: `Cymbal Fintech Web Portal running on http://localhost:${PORT}`
  }));
});
