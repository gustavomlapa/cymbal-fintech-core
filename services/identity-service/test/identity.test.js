const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMerge } = require('../src/utils/merge');
const { CustomerStore } = require('../src/services/customer_store');
const { JwtService } = require('../src/services/jwt_service');

test('CustomerStore retrieves existing seeded customer', () => {
  const store = new CustomerStore();
  const customer = store.getById('cust_001');
  assert.ok(customer);
  assert.equal(customer.fullName, 'Alice Silva');
  assert.equal(customer.kycStatus, 'VERIFIED');
});

test('CustomerStore enriches profile with deepMerge', () => {
  const store = new CustomerStore();
  const update = {
    metadata: {
      occupation: 'Software Engineer',
      monthlyIncome: 18500
    }
  };
  const enriched = store.updateProfile('cust_001', update);
  assert.equal(enriched.metadata.occupation, 'Software Engineer');
  assert.equal(enriched.metadata.monthlyIncome, 18500);
});

test('deepMerge correctly merges nested properties', () => {
  const target = { a: 1, nested: { b: 2 } };
  const source = { nested: { c: 3 }, d: 4 };
  const result = deepMerge(target, source);
  assert.deepEqual(result, { a: 1, nested: { b: 2, c: 3 }, d: 4 });
});

test('deepMerge prevents prototype pollution via __proto__', () => {
  const target = {};
  const maliciousPayload = JSON.parse('{"__proto__": {"polluted": true}}');
  deepMerge(target, maliciousPayload);
  try {
    assert.equal(Object.prototype.polluted, undefined);
    assert.equal({}.polluted, undefined);
  } finally {
    delete Object.prototype.polluted;
  }
});


test('JwtService issues and validates valid token', () => {
  const jwtSvc = new JwtService();
  const token = jwtSvc.createToken({ sub: 'cust_001', role: 'customer' });
  assert.ok(token);

  const payload = jwtSvc.verifyToken(token);
  assert.equal(payload.sub, 'cust_001');
  assert.equal(payload.role, 'customer');
});

