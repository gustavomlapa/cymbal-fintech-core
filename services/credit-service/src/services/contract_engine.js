const ALLOWED_VARIABLES = new Set(['amount', 'term', 'score']);

function tokenize(formula) {
  const tokens = [];
  let pos = 0;
  const len = formula.length;

  while (pos < len) {
    const ch = formula[pos];
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Number literals (including decimals and scientific notation)
    if (/\d/.test(ch) || (ch === '.' && pos + 1 < len && /\d/.test(formula[pos + 1]))) {
      let start = pos;
      let hasDot = (ch === '.');
      pos++;
      while (pos < len) {
        if (formula[pos] === '.') {
          if (hasDot) break;
          hasDot = true;
          pos++;
        } else if (/\d/.test(formula[pos])) {
          pos++;
        } else if ((formula[pos] === 'e' || formula[pos] === 'E') && pos + 1 < len) {
          const next = formula[pos + 1];
          if ((next === '+' || next === '-') && pos + 2 < len && /\d/.test(formula[pos + 2])) {
            pos += 3;
            while (pos < len && /\d/.test(formula[pos])) pos++;
          } else if (/\d/.test(next)) {
            pos += 2;
            while (pos < len && /\d/.test(formula[pos])) pos++;
          }
          break;
        } else {
          break;
        }
      }
      const numStr = formula.slice(start, pos);
      const val = Number(numStr);
      if (Number.isNaN(val)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }

    // Identifiers and boolean/null literals
    if (/[a-zA-Z_$]/.test(ch)) {
      let start = pos;
      while (pos < len && /[a-zA-Z0-9_$]/.test(formula[pos])) {
        pos++;
      }
      const ident = formula.slice(start, pos);
      if (ident === 'true') {
        tokens.push({ type: 'BOOLEAN', value: true });
        continue;
      }
      if (ident === 'false') {
        tokens.push({ type: 'BOOLEAN', value: false });
        continue;
      }
      if (ident === 'null') {
        tokens.push({ type: 'NULL', value: null });
        continue;
      }
      if (!ALLOWED_VARIABLES.has(ident)) {
        throw new Error(`Unauthorized identifier: ${ident}`);
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    // 3-char operators
    if (pos + 2 < len) {
      const op3 = formula.slice(pos, pos + 3);
      if (op3 === '===' || op3 === '!==') {
        tokens.push({ type: 'OP', value: op3 });
        pos += 3;
        continue;
      }
    }

    // 2-char operators
    if (pos + 1 < len) {
      const op2 = formula.slice(pos, pos + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '**'].includes(op2)) {
        tokens.push({ type: 'OP', value: op2 });
        pos += 2;
        continue;
      }
    }

    // 1-char operators & punctuation
    if ('+-*/%<>?:()!'.includes(ch)) {
      tokens.push({ type: ch, value: ch });
      pos++;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  tokens.push({ type: 'EOF', value: 'EOF' });
  return tokens;
}

function parseFormula(formula) {
  const tokens = tokenize(formula);
  let index = 0;

  function peek() {
    return tokens[index] || { type: 'EOF', value: 'EOF' };
  }

  function consume(expected) {
    const token = peek();
    if (expected && token.type !== expected && token.value !== expected) {
      throw new Error(`Expected '${expected}', got '${token.value}'`);
    }
    index++;
    return token;
  }

  function parseExpression() {
    return parseTernary();
  }

  function parseTernary() {
    let node = parseLogicalOr();
    if (peek().type === '?') {
      consume('?');
      const consequent = parseExpression();
      consume(':');
      const alternate = parseTernary();
      node = { type: 'Conditional', test: node, consequent, alternate };
    }
    return node;
  }

  function parseLogicalOr() {
    let node = parseLogicalAnd();
    while (peek().value === '||') {
      const op = consume().value;
      const right = parseLogicalAnd();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseLogicalAnd() {
    let node = parseEquality();
    while (peek().value === '&&') {
      const op = consume().value;
      const right = parseEquality();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseEquality() {
    let node = parseRelational();
    while (['==', '!=', '===', '!=='].includes(peek().value)) {
      const op = consume().value;
      const right = parseRelational();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseRelational() {
    let node = parseAdditive();
    while (['<', '<=', '>', '>='].includes(peek().value)) {
      const op = consume().value;
      const right = parseAdditive();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseAdditive() {
    let node = parseMultiplicative();
    while (peek().type === '+' || peek().type === '-') {
      const op = consume().value;
      const right = parseMultiplicative();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseMultiplicative() {
    let node = parsePower();
    while (peek().type === '*' || peek().type === '/' || peek().type === '%') {
      const op = consume().value;
      const right = parsePower();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parsePower() {
    let node = parseUnary();
    if (peek().value === '**') {
      const op = consume().value;
      const right = parsePower();
      node = { type: 'Binary', operator: op, left: node, right };
    }
    return node;
  }

  function parseUnary() {
    const token = peek();
    if (token.type === '+' || token.type === '-' || token.type === '!') {
      consume();
      const argument = parseUnary();
      return { type: 'Unary', operator: token.value, argument };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();
    if (token.type === 'NUMBER' || token.type === 'BOOLEAN' || token.type === 'NULL') {
      consume();
      return { type: 'Literal', value: token.value };
    }
    if (token.type === 'IDENT') {
      consume();
      return { type: 'Identifier', name: token.value };
    }
    if (token.type === '(') {
      consume('(');
      const expr = parseExpression();
      consume(')');
      return expr;
    }
    throw new Error(`Unexpected token: '${token.value}'`);
  }

  const ast = parseExpression();
  if (peek().type !== 'EOF') {
    throw new Error(`Unexpected token after expression: '${peek().value}'`);
  }
  return ast;
}

function evaluateAst(node, variables) {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier':
      return variables[node.name];
    case 'Unary': {
      const val = evaluateAst(node.argument, variables);
      if (node.operator === '+') return +val;
      if (node.operator === '-') return -val;
      if (node.operator === '!') return !val;
      throw new Error(`Unknown unary operator: ${node.operator}`);
    }
    case 'Binary': {
      const left = evaluateAst(node.left, variables);
      if (node.operator === '&&') return left && evaluateAst(node.right, variables);
      if (node.operator === '||') return left || evaluateAst(node.right, variables);
      const right = evaluateAst(node.right, variables);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '**': return Math.pow(left, right);
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '==': return left == right;
        case '!=': return left != right;
        case '===': return left === right;
        case '!==': return left !== right;
        default: throw new Error(`Unknown binary operator: ${node.operator}`);
      }
    }
    case 'Conditional': {
      const test = evaluateAst(node.test, variables);
      return test ? evaluateAst(node.consequent, variables) : evaluateAst(node.alternate, variables);
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

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
   * Evaluates custom corporate rate formula adjustor safely without dynamic code execution.
   */
  evaluateCustomRateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string') {
      return 0.0;
    }

    const safeContext = context && typeof context === 'object' ? context : {};
    const variables = {
      amount: safeContext.amount !== undefined && safeContext.amount !== null ? safeContext.amount : 0,
      term: safeContext.term !== undefined && safeContext.term !== null ? safeContext.term : 0,
      score: safeContext.score !== undefined && safeContext.score !== null ? safeContext.score : 0
    };

    try {
      const ast = parseFormula(formula);
      return evaluateAst(ast, variables);
    } catch (err) {
      throw new Error(`Formula evaluation failed: ${err.message}`);
    }
  }
}

module.exports = { ContractEngine };
