// State management
let portalData = null;

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderLeftColor = isError ? '#ef4444' : '#10b981';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
  });
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

async function loadOverview() {
  try {
    const res = await fetch('/api/portal/overview');
    if (!res.ok) throw new Error('Falha ao carregar visão geral da conta');
    portalData = await res.json();

    // Render Balances & Customer
    document.getElementById('userName').textContent = portalData.customer.fullName;
    document.getElementById('userTier').textContent = portalData.customer.tier;
    document.getElementById('accountBalance').textContent = formatCurrency(portalData.account.balance);
    document.getElementById('accountNumber').textContent = portalData.account.accountNumber;

    // Render KYC tab details
    document.getElementById('kycFullName').textContent = portalData.customer.fullName;
    document.getElementById('kycDocument').textContent = portalData.customer.document;
    document.getElementById('kycEmail').textContent = portalData.customer.email;
    document.getElementById('kycPhone').textContent = portalData.customer.phone;

    // Render Transactions Table
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '';
    portalData.recentTransactions.forEach(tx => {
      const tr = document.createElement('tr');
      const isCredit = tx.type === 'CREDIT';
      tr.innerHTML = `
        <td>${tx.date}</td>
        <td>${tx.description}</td>
        <td><span class="badge ${isCredit ? 'badge-success' : 'badge-info'}">${tx.type}</span></td>
        <td class="${isCredit ? 'amount-credit' : 'amount-debit'}">${isCredit ? '+' : '-'}${formatCurrency(tx.amount)}</td>
        <td>${formatCurrency(tx.balanceAfter)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Render Proposals
    const propList = document.getElementById('proposalsList');
    if (propList) {
      propList.innerHTML = '';
      portalData.activeProposals.forEach(p => {
        const div = document.createElement('div');
        div.className = 'kyc-item';
        div.style.marginBottom = '1rem';
        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>Proposta #${p.id}</strong>
            <span class="badge badge-success">${p.status}</span>
          </div>
          <p style="font-size: 0.85rem; color: #94a3b8;">
            Valor: <strong>${formatCurrency(p.amount)}</strong> em <strong>${p.termMonths}x</strong> de <strong>${formatCurrency(p.monthlyInstallment)}</strong>
          </p>
        `;
        propList.appendChild(div);
      });
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Tab click handler
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const refreshBtn = document.getElementById('refreshOverviewBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadOverview);

  // PIX Form submission
  const pixForm = document.getElementById('pixTransferForm');
  if (pixForm) {
    pixForm.addEventListener('submit', async e => {
      e.preventDefault();
      const pixKey = document.getElementById('pixKeyInput').value;
      const amount = parseFloat(document.getElementById('pixAmountInput').value);
      const description = document.getElementById('pixDescInput').value;
      const isNewDevice = document.getElementById('pixNewDeviceCheck').checked;

      const sendBtn = document.getElementById('sendPixBtn');
      sendBtn.disabled = true;
      sendBtn.textContent = 'Processando no SPI...';

      try {
        // Step 1: Risk Assessment Check
        const riskRes = await fetch('/api/portal/risk/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, destinationPix: pixKey, isNewDevice })
        });
        const risk = await riskRes.json();

        // Update Risk Gauge UI
        document.getElementById('riskGaugeValue').textContent = risk.score;
        document.getElementById('riskStatusMsg').textContent = `Decisão do Motor: ${risk.decision} (Score: ${risk.score}/100)`;

        if (risk.decision === 'DENY') {
          throw new Error('Transação bloqueada pelas políticas antifraude da Cymbal');
        }

        // Step 2: Execute Transfer
        const res = await fetch('/api/portal/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pixKey, amount, description })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Erro ao processar transferência');

        showToast(`PIX de ${formatCurrency(amount)} enviado com sucesso!`);
        pixForm.reset();

        // Render receipt
        const receiptArea = document.getElementById('pixReceiptArea');
        receiptArea.innerHTML = `
          <div class="receipt-card">
            <div class="receipt-header">
              <span class="badge badge-success">LIQUIDADO COM SUCESSO</span>
              <h4 style="margin-top: 0.5rem;">Comprovante de Transferência PIX</h4>
              <p style="font-size: 0.75rem; color: #64748b;">ID da Transação: ${data.transaction.id}</p>
            </div>
            <div class="receipt-row"><span>Valor:</span><strong>${formatCurrency(amount)}</strong></div>
            <div class="receipt-row"><span>Chave Destino:</span><span>${pixKey}</span></div>
            <div class="receipt-row"><span>Origem:</span><span>Alice Silva (Agência 0001)</span></div>
            <div class="receipt-row"><span>Canal:</span><span>Internet Banking Web</span></div>
            <div class="receipt-row"><span>Horário:</span><span>${new Date().toLocaleTimeString('pt-BR')}</span></div>
          </div>
        `;

        await loadOverview();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Confirmar e Transferir PIX';
      }
    });
  }

  // Credit Simulator submission
  const creditForm = document.getElementById('creditSimForm');
  if (creditForm) {
    creditForm.addEventListener('submit', async e => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('simAmount').value);
      const termMonths = parseInt(document.getElementById('simTerm').value, 10);

      try {
        const res = await fetch('/api/portal/credit/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, termMonths, annualRate: 0.165 })
        });
        const sim = await res.json();

        document.getElementById('simResultBox').style.display = 'block';
        document.getElementById('simMonthlyInstallment').textContent = formatCurrency(sim.monthlyInstallment);
        document.getElementById('simTotalPayable').textContent = formatCurrency(sim.totalPayable);
        showToast('Simulação calculada com sucesso');
      } catch (err) {
        showToast('Erro ao simular crédito', true);
      }
    });
  }

  // Initial Load
  loadOverview();
});
