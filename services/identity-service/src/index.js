const http = require('node:http');
const { CustomerStore } = require('./services/customer_store');
const { JwtService } = require('./services/jwt_service');

const port = process.env.PORT || 8082;
const customerStore = new CustomerStore();
const jwtService = new JwtService();

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
        service: 'identity-service',
        version: '1.2.0',
        timestamp: new Date().toISOString()
      });
    }

    if (pathname === '/api/v1/customers' && method === 'GET') {
      const customers = customerStore.list();
      return sendJson(res, 200, { count: customers.length, customers });
    }

    const customerMatch = pathname.match(/^\/api\/v1\/customers\/([^/]+)$/);
    if (customerMatch && method === 'GET') {
      const customerId = customerMatch[1];
      const customer = customerStore.getById(customerId);
      if (!customer) {
        return sendJson(res, 404, { error: 'Customer not found' });
      }
      return sendJson(res, 200, customer);
    }

    const profileMatch = pathname.match(/^\/api\/v1\/customers\/([^/]+)\/profile$/);
    if (profileMatch && method === 'PATCH') {
      const customerId = profileMatch[1];
      const body = await parseBody(req);
      const updated = customerStore.updateProfile(customerId, body);
      if (!updated) {
        return sendJson(res, 404, { error: 'Customer not found' });
      }
      return sendJson(res, 200, { message: 'Profile updated successfully', customer: updated });
    }

    if (pathname === '/api/v1/auth/token' && method === 'POST') {
      const body = await parseBody(req);
      const customerId = body.customerId || 'cust_001';
      const customer = customerStore.getById(customerId);
      if (!customer) {
        return sendJson(res, 404, { error: 'Customer account not found' });
      }

      const token = jwtService.createToken({
        sub: customer.id,
        name: customer.fullName,
        tier: customer.tier,
        role: 'customer'
      });

      return sendJson(res, 200, {
        token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        customer: { id: customer.id, name: customer.fullName, tier: customer.tier }
      });
    }

    if (pathname === '/api/v1/auth/verify' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.token) {
        return sendJson(res, 400, { error: 'Missing token in body' });
      }

      try {
        const claims = jwtService.verifyToken(body.token);
        return sendJson(res, 200, { valid: true, claims });
      } catch (authErr) {
        return sendJson(res, 401, { valid: false, error: authErr.message });
      }
    }

    return sendJson(res, 404, { error: 'Route not found' });
  } catch (err) {
    return sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
});

server.listen(port, () => {
  console.log(JSON.stringify({
    level: 'INFO',
    service: 'identity-service',
    message: `Identity & KYC service running on port ${port}`
  }));
});
