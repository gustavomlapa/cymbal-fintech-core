const test = require('node:test');
const assert = require('node:assert/strict');
const { ProposalStore } = require('../src/services/proposal_store');
const { ContractEngine } = require('../src/services/contract_engine');

test('ContractEngine simulates personal loan amortization accurately', () => {
  const engine = new ContractEngine();
  const sim = engine.simulateLoan({
    amount: 10000.0,
    termMonths: 12,
    annualRate: 0.18
  });

  assert.ok(sim.monthlyInstallment > 0);
  assert.equal(sim.termMonths, 12);
  assert.ok(sim.totalPayable > 10000.0);
  assert.equal(sim.schedule.length, 12);
});

test('ProposalStore creates and retrieves a new credit proposal', () => {
  const store = new ProposalStore();
  const created = store.createProposal({
    customerId: 'cust_001',
    amount: 15000.0,
    termMonths: 24,
    purpose: 'EXPANSION'
  });

  assert.ok(created.id);
  assert.equal(created.status, 'ANALYSIS_PENDING');
  assert.equal(created.amount, 15000.0);

  const fetched = store.getById(created.id);
  assert.equal(fetched.id, created.id);
});

test('ProposalStore updates proposal status', () => {
  const store = new ProposalStore();
  const proposal = store.getById('prop_101');
  assert.ok(proposal);

  const updated = store.updateStatus('prop_101', 'APPROVED', 'Credit score verified');
  assert.equal(updated.status, 'APPROVED');
});

