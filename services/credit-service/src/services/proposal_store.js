class ProposalStore {
  constructor() {
    this.proposals = new Map();
    this.seed();
  }

  seed() {
    this.proposals.set('prop_101', {
      id: 'prop_101',
      customerId: 'cust_001',
      amount: 25000.0,
      termMonths: 24,
      annualRate: 0.165,
      monthlyInstallment: 1228.45,
      purpose: 'INVESTMENT',
      status: 'APPROVED',
      creditScore: 840,
      history: [
        { status: 'DRAFT', at: '2026-09-01T10:00:00Z', note: 'Proposal originated via mobile banking' },
        { status: 'ANALYSIS_PENDING', at: '2026-09-01T10:05:00Z', note: 'Sent to automated underwriting engine' },
        { status: 'APPROVED', at: '2026-09-01T10:10:00Z', note: 'Automated scoring passed' }
      ],
      createdAt: '2026-09-01T10:00:00Z'
    });

    this.proposals.set('prop_102', {
      id: 'prop_102',
      customerId: 'cust_002',
      amount: 5000.0,
      termMonths: 12,
      annualRate: 0.22,
      monthlyInstallment: 468.20,
      purpose: 'PERSONAL_EXPENSE',
      status: 'ANALYSIS_PENDING',
      creditScore: 610,
      history: [
        { status: 'DRAFT', at: '2026-09-05T15:00:00Z', note: 'Originated' },
        { status: 'ANALYSIS_PENDING', at: '2026-09-05T15:01:00Z', note: 'Underwriting pending documents' }
      ],
      createdAt: '2026-09-05T15:00:00Z'
    });

    this.proposals.set('prop_103', {
      id: 'prop_103',
      customerId: 'cust_003',
      amount: 500000.0,
      termMonths: 36,
      annualRate: 0.125,
      monthlyInstallment: 16726.80,
      purpose: 'WORKING_CAPITAL',
      status: 'DISBURSEMENT_READY',
      creditScore: 920,
      history: [
        { status: 'DRAFT', at: '2026-08-20T09:00:00Z', note: 'Institutional proposal' },
        { status: 'APPROVED', at: '2026-08-21T11:00:00Z', note: 'Approved by credit committee' },
        { status: 'CONTRACT_SIGNED', at: '2026-08-22T14:00:00Z', note: 'Digital signature verified' },
        { status: 'DISBURSEMENT_READY', at: '2026-08-23T08:00:00Z', note: 'Ready for escrow release' }
      ],
      createdAt: '2026-08-20T09:00:00Z'
    });
  }

  getById(id) {
    const prop = this.proposals.get(id);
    return prop ? JSON.parse(JSON.stringify(prop)) : null;
  }

  list(customerId = null) {
    let list = Array.from(this.proposals.values());
    if (customerId) {
      list = list.filter(p => p.customerId === customerId);
    }
    return list.map(p => JSON.parse(JSON.stringify(p)));
  }

  createProposal({ customerId, amount, termMonths, purpose }) {
    const id = `prop_${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const annualRate = 0.18;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const monthlyInstallment = parseFloat((amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)))).toFixed(2));

    const proposal = {
      id,
      customerId,
      amount,
      termMonths,
      annualRate,
      monthlyInstallment,
      purpose: purpose || 'PERSONAL',
      status: 'ANALYSIS_PENDING',
      creditScore: 750,
      history: [
        { status: 'DRAFT', at: now, note: 'Created online' },
        { status: 'ANALYSIS_PENDING', at: now, note: 'Submitted for underwriting' }
      ],
      createdAt: now
    };

    this.proposals.set(id, proposal);
    return JSON.parse(JSON.stringify(proposal));
  }

  /**
   * Updates proposal lifecycle status.
   * Note: Missing transition guard allows jumping directly from DRAFT or REJECTED to DISBURSEMENT_READY.
   */
  updateStatus(id, newStatus, reason = '') {
    const proposal = this.proposals.get(id);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Business logic vulnerability: omits strict state-machine transition guard validation
    if (proposal.status === 'CANCELLED') {
      throw new Error('Cannot update cancelled proposal');
    }

    proposal.status = newStatus;
    proposal.history.push({
      status: newStatus,
      at: new Date().toISOString(),
      note: reason || 'Status updated'
    });

    this.proposals.set(id, proposal);
    return JSON.parse(JSON.stringify(proposal));
  }
}

module.exports = { ProposalStore };

