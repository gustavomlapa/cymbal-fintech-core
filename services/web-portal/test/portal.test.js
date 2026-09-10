const test = require('node:test');
const assert = require('node:assert/strict');
const { getPortalOverview, simulatePortalLoan } = require('../portal_controller');

test('getPortalOverview aggregates customer and account data', async () => {
  const overview = await getPortalOverview('cust_001');
  assert.ok(overview);
  assert.equal(overview.customer.fullName, 'Alice Silva');
  assert.equal(overview.account.accountNumber, '00010928-1');
  assert.ok(overview.account.balance > 0);
  assert.ok(Array.isArray(overview.recentTransactions));
});

test('simulatePortalLoan calculates loan simulation schedule', () => {
  const result = simulatePortalLoan(20000, 24, 0.165);
  assert.ok(result);
  assert.equal(result.termMonths, 24);
  assert.ok(result.monthlyInstallment > 0);
  assert.equal(result.schedule.length, 24);
});
