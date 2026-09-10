const http = require('node:http');
const { ProposalStore } = require('./services/proposal_store');
const { ContractEngine } = require('./services/contract_engine');

const port = process.env.PORT || 8084;
const proposalStore = new ProposalStore();
const contractEngine = new ContractEngine();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Customer-ID'
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Customer-ID'
    });
    return res.end();
  }

  try {
    if (pathname === '/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'UP',
        service: 'credit-service',
        version: '1.2.0',
        timestamp: new Date().toISOString()
      });
    }

    if (pathname === '/api/v1/credit/simulate' && method === 'POST') {
      const body = await parseBody(req);
      const amount = parseFloat(body.amount);
      const termMonths = parseInt(body.termMonths, 10);
      const annualRate = body.annualRate ? parseFloat(body.annualRate) : 0.18;

      try {
        const simulation = contractEngine.simulateLoan({ amount, termMonths, annualRate });
        return sendJson(res, 200, simulation);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    if (pathname === '/api/v1/credit/proposals' && method === 'GET') {
      const customerId = url.searchParams.get('customerId');
      const proposals = proposalStore.list(customerId);
      return sendJson(res, 200, { count: proposals.length, proposals });
    }

    if (pathname === '/api/v1/credit/proposals' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.customerId || !body.amount || !body.termMonths) {
        return sendJson(res, 400, { error: 'customerId, amount, and termMonths are required' });
      }

      const proposal = proposalStore.createProposal(body);
      return sendJson(res, 201, proposal);
    }

    const proposalMatch = pathname.match(/^\/api\/v1\/credit\/proposals\/([^/]+)$/);
    if (proposalMatch && method === 'GET') {
      const id = proposalMatch[1];
      const proposal = proposalStore.getById(id);
      if (!proposal) {
        return sendJson(res, 404, { error: 'Proposal not found' });
      }
      return sendJson(res, 200, proposal);
    }

    const statusMatch = pathname.match(/^\/api\/v1\/credit\/proposals\/([^/]+)\/status$/);
    if (statusMatch && method === 'PATCH') {
      const id = statusMatch[1];
      const body = await parseBody(req);
      if (!body.status) {
        return sendJson(res, 400, { error: 'status field is required' });
      }

      try {
        const updated = proposalStore.updateStatus(id, body.status, body.reason);
        return sendJson(res, 200, updated);
      } catch (err) {
        return sendJson(res, 422, { error: err.message });
      }
    }

    const formulaMatch = pathname.match(/^\/api\/v1\/credit\/proposals\/([^/]+)\/evaluate-formula$/);
    if (formulaMatch && method === 'POST') {
      const body = await parseBody(req);
      try {
        const rate = contractEngine.evaluateCustomRateFormula(body.formula, body.context);
        return sendJson(res, 200, { customRate: rate });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    return sendJson(res, 404, { error: 'Route not found' });
  } catch (err) {
    return sendJson(res, 500, { error: 'Internal credit engine error', details: err.message });
  }
});

server.listen(port, () => {
  console.log(JSON.stringify({
    level: 'INFO',
    service: 'credit-service',
    message: `Credit & Underwriting service running on port ${port}`
  }));
});

