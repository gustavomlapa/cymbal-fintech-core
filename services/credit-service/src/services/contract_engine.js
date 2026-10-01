const ALLOWED_VARS = new Set(['amount', 'term', 'score']);

const ALLOWED_CONSTS = Object.freeze({
  PI: Math.PI,
  'Math.PI': Math.PI,
  E: Math.E,
  'Math.E': Math.E
});

const ALLOWED_FUNCS = Object.freeze({
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  pow: Math.pow,
  sqrt: Math.sqrt,
  'Math.min': Math.min,
  'Math.max': Math.max,
  'Math.round': Math.round,
  'Math.floor': Math.floor,
  'Math.ceil': Math.ceil,
  'Math.abs': Math.abs,
  'Math.pow': Math.pow,
  'Math.sqrt': Math.sqrt
});

function tokenize(formula) {
  if (formula.length > 1000) {
    throw new Error('Formula exceeds maximum length');
  }
  const tokens = [];
  let i = 0;
  const len = formula.length;

  while (i < len) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literals (e.g. 100, 3.14, .5, 1e-3)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(formula[i + 1]))) {
      let numStr = '';
      while (i < len && (/\d/.test(formula[i]) || formula[i] === '.')) {
        numStr += formula[i];
        i++;
      }
      if (i < len && (formula[i] === 'e' || formula[i] === 'E')) {
        numStr += formula[i];
        i++;
        if (i < len && (formula[i] === '+' || formula[i] === '-')) {
          numStr += formula[i];
          i++;
        }
        while (i < len && /\d/.test(formula[i])) {
          numStr += formula[i];
          i++;
        }
      }
      const num = Number(numStr);
      if (isNaN(num)) {
        throw new Error(`Invalid number literal: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // 3-char operators
    const three = formula.slice(i, i + 3);
    if (three === '===' || three === '!==') {
      tokens.push({ type: 'OP', value: three });
      i += 3;
      continue;
    }

    // 2-char operators
    const two = formula.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||') {
      tokens.push({ type: 'OP', value: two });
      i += 2;
      continue;
    }

    // Single-char operators and punctuation
    if ('+-*/%<>!?():,'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    // Identifiers (variable names, Math functions)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_.]/.test(formula[i])) {
        ident += formula[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    throw new Error(`Unexpected character: '${ch}'`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.depth = 0;
    this.maxDepth = 50;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expectedValue) {
    const tok = this.tokens[this.pos];
    if (expectedValue && tok.value !== expectedValue) {
      throw new Error(`Expected '${expectedValue}', found '${tok.value}'`);
    }
    this.pos++;
    return tok;
  }

  parse() {
    if (this.peek().type === 'EOF') {
      throw new Error('Empty expression');
    }
    const node = this.parseConditional();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token after expression: '${this.peek().value}'`);
    }
    return node;
  }

  parseConditional() {
    if (++this.depth > this.maxDepth) throw new Error('Maximum expression depth exceeded');
    try {
      const expr = this.parseLogicalOr();
      if (this.peek().type === 'OP' && this.peek().value === '?') {
        this.consume('?');
        const consequent = this.parseConditional();
        this.consume(':');
        const alternate = this.parseConditional();
        return { type: 'Conditional', test: expr, consequent, alternate };
      }
      return expr;
    } finally {
      this.depth--;
    }
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'OP' && this.peek().value === '||') {
      const op = this.consume().value;
      const right = this.parseLogicalAnd();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.peek().type === 'OP' && this.peek().value === '&&') {
      const op = this.consume().value;
      const right = this.parseEquality();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseRelational();
    while (this.peek().type === 'OP' && (this.peek().value === '==' || this.peek().value === '!=' || this.peek().value === '===' || this.peek().value === '!==')) {
      const op = this.consume().value;
      const right = this.parseRelational();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseRelational() {
    let left = this.parseAdditive();
    while (this.peek().type === 'OP' && (this.peek().value === '<' || this.peek().value === '<=' || this.peek().value === '>' || this.peek().value === '>=')) {
      const op = this.consume().value;
      const right = this.parseAdditive();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')) {
      const op = this.consume().value;
      const right = this.parseUnary();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-' || this.peek().value === '!')) {
      const op = this.consume().value;
      const argument = this.parseUnary();
      return { type: 'Unary', operator: op, argument };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.consume();
      return { type: 'Literal', value: tok.value };
    }

    if (tok.type === 'OP' && tok.value === '(') {
      this.consume('(');
      const expr = this.parseConditional();
      this.consume(')');
      return expr;
    }

    if (tok.type === 'IDENT') {
      const name = this.consume().value;
      if (name === 'true') return { type: 'Literal', value: true };
      if (name === 'false') return { type: 'Literal', value: false };
      if (ALLOWED_VARS.has(name)) {
        return { type: 'Variable', name };
      }
      if (Object.prototype.hasOwnProperty.call(ALLOWED_CONSTS, name)) {
        return { type: 'Literal', value: ALLOWED_CONSTS[name] };
      }
      if (Object.prototype.hasOwnProperty.call(ALLOWED_FUNCS, name)) {
        this.consume('(');
        const args = [];
        if (this.peek().type !== 'OP' || this.peek().value !== ')') {
          args.push(this.parseConditional());
          while (this.peek().type === 'OP' && this.peek().value === ',') {
            this.consume(',');
            args.push(this.parseConditional());
          }
        }
        this.consume(')');
        return { type: 'Call', callee: name, args };
      }
      throw new Error(`Unknown identifier: '${name}'`);
    }

    throw new Error(`Unexpected token: '${tok.value}'`);
  }
}

function evaluateAst(node, context) {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Variable': {
      const val = Number(context ? context[node.name] : 0);
      return isNaN(val) ? 0 : val;
    }
    case 'Unary': {
      const val = evaluateAst(node.argument, context);
      if (node.operator === '+') return +val;
      if (node.operator === '-') return -val;
      if (node.operator === '!') return !val;
      throw new Error(`Unknown unary operator: ${node.operator}`);
    }
    case 'Binary': {
      if (node.operator === '&&') {
        const left = evaluateAst(node.left, context);
        return left ? evaluateAst(node.right, context) : left;
      }
      if (node.operator === '||') {
        const left = evaluateAst(node.left, context);
        return left ? left : evaluateAst(node.right, context);
      }
      const left = evaluateAst(node.left, context);
      const right = evaluateAst(node.right, context);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==':
        case '===': return left === right;
        case '!=':
        case '!==': return left !== right;
        default:
          throw new Error(`Unknown binary operator: ${node.operator}`);
      }
    }
    case 'Conditional': {
      const test = evaluateAst(node.test, context);
      return test ? evaluateAst(node.consequent, context) : evaluateAst(node.alternate, context);
    }
    case 'Call': {
      const fn = ALLOWED_FUNCS[node.callee];
      if (!fn) throw new Error(`Unknown function: ${node.callee}`);
      const args = node.args.map(arg => evaluateAst(arg, context));
      return fn(...args);
    }
    default:
      throw new Error(`Unknown AST node type: ${node.type}`);
  }
}

function safeEvaluateFormula(formula, context) {
  const tokens = tokenize(formula);
  const parser = new ExpressionParser(tokens);
  const ast = parser.parse();
  return evaluateAst(ast, context);
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
   * Evaluates custom corporate rate formula adjustor safely without dynamic code evaluation.
   */
  evaluateCustomRateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string' || formula.trim() === '') {
      return 0.0;
    }

    try {
      return safeEvaluateFormula(formula, {
        amount: context.amount || 0,
        term: context.term || 0,
        score: context.score || 0
      });
    } catch (err) {
      throw new Error(`Formula evaluation failed: ${err.message}`);
    }
  }
}

module.exports = { ContractEngine };
