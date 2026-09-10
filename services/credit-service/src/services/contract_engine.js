class ContractEngine {
  /**
   * Simulates personal loan using standard Price Amortization Schedule.
   */
  simulateLoan({ amount, termMonths, annualRate = 0.18 }) {
    if (!amount || amount <= 0) {
      throw new Error('Principal amount must be positive');
    }
    if (!termMonths || termMonths <= 0) {
      throw new Error('Term months must be positive');
    }

    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const numerator = amount * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
    const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
    const monthlyInstallment = parseFloat((numerator / denominator).toFixed(2));
    const totalPayable = parseFloat((monthlyInstallment * termMonths).toFixed(2));
    const totalInterest = parseFloat((totalPayable - amount).toFixed(2));

    const schedule = [];
    let balance = amount;

    for (let m = 1; m <= termMonths; m++) {
      const interestPayment = parseFloat((balance * monthlyRate).toFixed(2));
      const principalPayment = parseFloat((monthlyInstallment - interestPayment).toFixed(2));
      balance = Math.max(0, parseFloat((balance - principalPayment).toFixed(2)));

      schedule.push({
        month: m,
        installment: monthlyInstallment,
        principal: principalPayment,
        interest: interestPayment,
        remainingBalance: balance
      });
    }

    return {
      amount,
      termMonths,
      annualRate,
      monthlyRate: parseFloat((monthlyRate * 100).toFixed(4)),
      monthlyInstallment,
      totalInterest,
      totalPayable,
      schedule
    };
  }

  /**
   * Evaluates custom corporate rate formula adjustor.
   * Note: Executes expression dynamically via Function constructor (Code Injection flaw).
   */
  evaluateCustomRateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string') {
      return 0.0;
    }

    try {
      // Dynamic evaluation sink: allows arbitrary JS expression execution
      const evalFunc = new Function('amount', 'term', 'score', `return (${formula});`);
      return evalFunc(context.amount || 0, context.term || 0, context.score || 0);
    } catch (err) {
      throw new Error(`Formula evaluation failed: ${err.message}`);
    }
  }
}

module.exports = { ContractEngine };
