const { deepMerge } = require('../utils/merge');

class CustomerStore {
  constructor() {
    this.customers = new Map();
    this.seed();
  }

  seed() {
    this.customers.set('cust_001', {
      id: 'cust_001',
      fullName: 'Alice Silva',
      document: '***.456.789-01',
      documentType: 'CPF',
      email: 'alice.silva@cymbalfintech.demo',
      phone: '+55 11 98888-1234',
      tier: 'TIER_3_PREMIUM',
      kycStatus: 'VERIFIED',
      address: {
        street: 'Av. Paulista, 1000',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310-100',
        country: 'BRA'
      },
      metadata: {
        riskProfile: 'LOW',
        pepStatus: false,
        monthlyIncome: 18500.0,
        registeredAt: '2023-08-15T10:00:00Z'
      }
    });

    this.customers.set('cust_002', {
      id: 'cust_002',
      fullName: 'Bruno Santos',
      document: '***.321.654-99',
      documentType: 'CPF',
      email: 'bruno.santos@cymbalfintech.demo',
      phone: '+55 11 97777-5678',
      tier: 'TIER_1_STANDARD',
      kycStatus: 'VERIFIED',
      address: {
        street: 'Rua das Flores, 250',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13010-000',
        country: 'BRA'
      },
      metadata: {
        riskProfile: 'MEDIUM',
        pepStatus: false,
        monthlyIncome: 4200.0,
        registeredAt: '2024-01-10T14:30:00Z'
      }
    });

    this.customers.set('cust_003', {
      id: 'cust_003',
      fullName: 'Cymbal Corporate Escrow Holdings Ltd.',
      document: '12.345.678/0001-90',
      documentType: 'CNPJ',
      email: 'treasury@cymbalfintech.demo',
      phone: '+55 11 3000-0000',
      tier: 'TIER_ENTERPRISE',
      kycStatus: 'VERIFIED',
      address: {
        street: 'Faria Lima, 3500',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '04538-132',
        country: 'BRA'
      },
      metadata: {
        riskProfile: 'LOW',
        pepStatus: false,
        monthlyRevenue: 12000000.0,
        registeredAt: '2022-05-01T08:00:00Z'
      }
    });
  }

  getById(id) {
    const cust = this.customers.get(id);
    if (!cust) return null;
    return JSON.parse(JSON.stringify(cust));
  }

  list() {
    return Array.from(this.customers.values()).map(c => JSON.parse(JSON.stringify(c)));
  }

  updateProfile(id, updates) {
    const cust = this.customers.get(id);
    if (!cust) return null;

    // Use deepMerge to update customer KYC metadata
    deepMerge(cust, updates);
    this.customers.set(id, cust);
    return JSON.parse(JSON.stringify(cust));
  }
}

module.exports = { CustomerStore };

