const test = require('node:test');
const assert = require('node:assert/strict');
const { getPortalOverview, simulatePortalLoan, executePortalTransfer } = require('../portal_controller');

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

test('portal_controller uses Spanish strings for transactions and error validation', async () => {
  const overview = await getPortalOverview('cust_001');
  const tx1 = overview.recentTransactions[0];
  assert.ok(tx1.description.includes('PIX recibido'), 'Expected Spanish description in recent transactions');
  assert.ok(tx1.date.startsWith('Hoy'), 'Expected Spanish date "Hoy" in recent transactions');

  // Test error validations in Spanish
  assert.throws(
    () => executePortalTransfer({ amount: 0, pixKey: 'test@cymbal.demo' }),
    /Monto inválido para transferencia/
  );
  assert.throws(
    () => executePortalTransfer({ amount: 99999999, pixKey: 'test@cymbal.demo' }),
    /Saldo insuficiente para transferencia/
  );

  // Test successful transfer creates transaction in Spanish
  const transferResult = executePortalTransfer({
    amount: 10,
    pixKey: 'dest@cymbal.demo',
    description: 'Servicios'
  });
  assert.equal(transferResult.transaction.date, 'Ahora');
  assert.ok(transferResult.transaction.description.includes('PIX enviado'));
});

