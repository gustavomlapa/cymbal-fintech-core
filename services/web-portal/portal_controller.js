// In-memory portal state for standalone and integrated demo execution
const state = {
  customer: {
    id: 'cust_001',
    fullName: 'Alice Silva',
    document: '***.456.789-01',
    tier: 'TIER_3_PREMIUM',
    kycStatus: 'VERIFIED',
    email: 'alice.silva@cymbalfintech.demo',
    phone: '+55 11 98888-1234'
  },
  account: {
    id: 'acc_1001',
    customerId: 'cust_001',
    accountNumber: '00010928-1',
    branchCode: '0001',
    accountType: 'CHECKING',
    currency: 'BRL',
    balance: 25480.50,
    blockedAmount: 0.0,
    status: 'ACTIVE'
  },
  recentTransactions: [
    {
      id: 'tx_901',
      type: 'CREDIT',
      amount: 5000.00,
      balanceAfter: 25480.50,
      description: 'PIX recebido - Consultoria Cymbal',
      date: 'Hoje, 10:30'
    },
    {
      id: 'tx_902',
      type: 'DEBIT',
      amount: 350.00,
      balanceAfter: 20480.50,
      description: 'Pagamento de Boleto de Serviços',
      date: 'Ontem, 16:45'
    },
    {
      id: 'tx_903',
      type: 'CREDIT',
      amount: 12500.00,
      balanceAfter: 20830.50,
      description: 'Transferência TED - Distribuição de Dividendos',
      date: '05 Set, 09:12'
    }
  ],
  proposals: [
    {
      id: 'prop_101',
      amount: 25000.0,
      termMonths: 24,
      monthlyInstallment: 1228.45,
      status: 'APPROVED',
      purpose: 'INVESTMENT'
    }
  ]
};

async function getPortalOverview(customerId = 'cust_001') {
  return {
    customer: state.customer,
    account: state.account,
    recentTransactions: state.recentTransactions,
    activeProposals: state.proposals,
    metrics: {
      creditLimitAvailable: 75000.00,
      monthlySpend: 4820.00,
      riskScore: 12,
      riskLevel: 'LOW'
    }
  };
}

function simulatePortalLoan(amount, termMonths, annualRate = 0.165) {
  const principal = parseFloat(amount);
  const term = parseInt(termMonths, 10);
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, term);
  const denominator = Math.pow(1 + monthlyRate, term) - 1;
  const monthlyInstallment = parseFloat((numerator / denominator).toFixed(2));
  const totalPayable = parseFloat((monthlyInstallment * term).toFixed(2));
  const totalInterest = parseFloat((totalPayable - principal).toFixed(2));

  const schedule = [];
  let balance = principal;

  for (let m = 1; m <= term; m++) {
    const interest = parseFloat((balance * monthlyRate).toFixed(2));
    const amortization = parseFloat((monthlyInstallment - interest).toFixed(2));
    balance = Math.max(0, parseFloat((balance - amortization).toFixed(2)));

    schedule.push({
      month: m,
      installment: monthlyInstallment,
      principal: amortization,
      interest: interest,
      balance: balance
    });
  }

  return {
    amount: principal,
    termMonths: term,
    annualRate,
    monthlyInstallment,
    totalInterest,
    totalPayable,
    schedule
  };
}

function executePortalTransfer({ amount, pixKey, description }) {
  const val = parseFloat(amount);
  if (val <= 0) {
    throw new Error('Valor inválido para transferência');
  }
  if (state.account.balance < val) {
    throw new Error('Saldo insuficiente para transferência');
  }

  state.account.balance = parseFloat((state.account.balance - val).toFixed(2));
  const newTx = {
    id: `tx_${Date.now().toString().slice(-6)}`,
    type: 'DEBIT',
    amount: val,
    balanceAfter: state.account.balance,
    description: `PIX enviado: ${pixKey} - ${description || 'Transferência'}`,
    date: 'Agora'
  };

  state.recentTransactions.unshift(newTx);
  return {
    success: true,
    transaction: newTx,
    updatedBalance: state.account.balance
  };
}

function evaluatePortalRisk({ amount, destinationPix, isNewDevice }) {
  const val = parseFloat(amount || 0);
  let score = 10;
  const flags = [];

  if (val > 10000) {
    score += 40;
    flags.push('VALOR_ELEVADO');
  }
  if (isNewDevice) {
    score += 25;
    flags.push('DISPOSITIVO_NAO_RECONHECIDO');
  }

  let decision = 'APPROVE';
  if (score > 70) decision = 'DENY';
  else if (score >= 40) decision = 'CHALLENGE_OTP';

  return {
    score,
    decision,
    flags,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = {
  getPortalOverview,
  simulatePortalLoan,
  executePortalTransfer,
  evaluatePortalRisk
};
