const ALLOWED_MATH_FNS = new Set(['min', 'max', 'pow', 'sqrt', 'abs', 'round', 'floor', 'ceil']);
const SAFE_MATH = {
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil
};

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      let numStr = '';
      while (i < len && /[\d.]/.test(input[i])) {
        if (input[i] === '.' && numStr.includes('.')) break;
        numStr += input[i++];
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        let expStr = input[i];
        let j = i + 1;
        if (j < len && (input[j] === '+' || input[j] === '-')) {
          expStr += input[j++];
        }
        if (j < len && /\d/.test(input[j])) {
          while (j < len && /\d/.test(input[j])) {
            expStr += input[j++];
          }
          numStr += expStr;
          i = j;
        }
      }
      const val = Number(numStr);
      if (isNaN(val)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        id += input[i++];
      }
      tokens.push({ type: 'IDENTIFIER', value: id });
      continue;
    }

    const threeChars = input.slice(i, i + 3);
    if (threeChars === '===' || threeChars === '!==') {
      tokens.push({ type: 'OPERATOR', value: threeChars });
      i += 3;
      continue;
    }

    const twoChars = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '**'].includes(twoChars)) {
      tokens.push({ type: 'OPERATOR', value: twoChars });
      i += 2;
      continue;
    }

    if (['+', '-', '*', '/', '%', '!', '<', '>', '?', ':', '(', ')', ',', '.'].includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${ch}'`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

class FormulaParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.depth = 0;
  }

  peek() {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  next() {
    return this.tokens[this.pos++];
  }

  consume(val) {
    const tok = this.next();
    if (tok.value !== val) {
      throw new Error(`Expected '${val}' but got '${tok.value || tok.type}'`);
    }
    return tok;
  }

  parse() {
    const ast = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected trailing token: '${this.peek().value}'`);
    }
    return ast;
  }

  parseExpression() {
    if (++this.depth > 50) {
      throw new Error('Expression nesting too deep');
    }
    try {
      return this.parseConditional();
    } finally {
      this.depth--;
    }
  }

  parseConditional() {
    const test = this.parseLogicalOr();
    if (this.peek().type === 'OPERATOR' && this.peek().value === '?') {
      this.next();
      const consequent = this.parseConditional();
      this.consume(':');
      const alternate = this.parseConditional();
      return { type: 'Conditional', test, consequent, alternate };
    }
    return test;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'OPERATOR' && this.peek().value === '||') {
      const op = this.next().value;
      const right = this.parseLogicalAnd();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.peek().type === 'OPERATOR' && this.peek().value === '&&') {
      const op = this.next().value;
      const right = this.parseEquality();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseRelational();
    while (this.peek().type === 'OPERATOR' && ['==', '!=', '===', '!=='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseRelational();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseRelational() {
    let left = this.parseAdditive();
    while (this.peek().type === 'OPERATOR' && ['<', '<=', '>', '>='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAdditive();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseExponentiation();
    while (this.peek().type === 'OPERATOR' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseExponentiation();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseExponentiation() {
    const left = this.parseUnary();
    if (this.peek().type === 'OPERATOR' && this.peek().value === '**') {
      const op = this.next().value;
      const right = this.parseExponentiation();
      return { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  parseUnary() {
    const tok = this.peek();
    if (tok.type === 'OPERATOR' && ['+', '-', '!'].includes(tok.value)) {
      this.next();
      const argument = this.parseUnary();
      return { type: 'Unary', operator: tok.value, argument };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.next();
      return { type: 'Literal', value: tok.value };
    }

    if (tok.type === 'OPERATOR' && tok.value === '(') {
      this.next();
      const expr = this.parseExpression();
      this.consume(')');
      return expr;
    }

    if (tok.type === 'IDENTIFIER') {
      this.next();
      const id = tok.value;

      if (id === 'true') return { type: 'Literal', value: true };
      if (id === 'false') return { type: 'Literal', value: false };

      if (id === 'Math') {
        this.consume('.');
        const fnTok = this.peek();
        if (fnTok.type !== 'IDENTIFIER' || !ALLOWED_MATH_FNS.has(fnTok.value)) {
          throw new Error(`Unsupported Math function: '${fnTok.value}'`);
        }
        this.next();
        const fnName = fnTok.value;
        this.consume('(');
        const args = this.parseArgList();
        this.consume(')');
        return { type: 'Call', callee: fnName, args };
      }

      if (ALLOWED_MATH_FNS.has(id) && this.peek().type === 'OPERATOR' && this.peek().value === '(') {
        this.next();
        const args = this.parseArgList();
        this.consume(')');
        return { type: 'Call', callee: id, args };
      }

      if (this.peek().type === 'OPERATOR' && ['(', '.', '['].includes(this.peek().value)) {
        throw new Error(`Invalid invocation or property access on identifier: '${id}'`);
      }

      return { type: 'Identifier', name: id };
    }

    throw new Error(`Unexpected token: '${tok.value || tok.type}'`);
  }

  parseArgList() {
    const args = [];
    if (this.peek().type === 'OPERATOR' && this.peek().value === ')') {
      return args;
    }
    while (true) {
      args.push(this.parseExpression());
      if (this.peek().type === 'OPERATOR' && this.peek().value === ',') {
        this.next();
      } else {
        break;
      }
    }
    return args;
  }
}

function evaluateAst(node, context) {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier': {
      const name = node.name;
      if (['amount', 'term', 'score'].includes(name)) {
        const val = context[name];
        return typeof val === 'number' ? val : (Number(val) || 0);
      }
      if (['__proto__', 'constructor', 'prototype'].includes(name)) {
        throw new Error(`Forbidden identifier '${name}'`);
      }
      if (Object.prototype.hasOwnProperty.call(context, name)) {
        const val = context[name];
        if (typeof val === 'number') return val;
        const num = Number(val);
        if (Number.isFinite(num)) return num;
      }
      throw new Error(`Unknown identifier '${name}'`);
    }

    case 'Unary': {
      const val = evaluateAst(node.argument, context);
      if (node.operator === '+') return +val;
      if (node.operator === '-') return -val;
      if (node.operator === '!') return !val;
      throw new Error(`Unsupported unary operator: '${node.operator}'`);
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
        case '/': {
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        }
        case '%': return left % right;
        case '**': return Math.pow(left, right);
        case '==': return left == right;
        case '!=': return left != right;
        case '===': return left === right;
        case '!==': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        default:
          throw new Error(`Unsupported operator: '${node.operator}'`);
      }
    }

    case 'Conditional': {
      const test = evaluateAst(node.test, context);
      return test
        ? evaluateAst(node.consequent, context)
        : evaluateAst(node.alternate, context);
    }

    case 'Call': {
      const fn = SAFE_MATH[node.callee];
      if (!fn) {
        throw new Error(`Unknown function: '${node.callee}'`);
      }
      const args = node.args.map(a => evaluateAst(a, context));
      return fn(...args);
    }

    default:
      throw new Error(`Unknown AST node type: '${node.type}'`);
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
   * Evaluates custom corporate rate formula adjustor safely.
   */
  evaluateCustomRateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string' || !formula.trim()) {
      return 0.0;
    }
    if (formula.length > 1000) {
      throw new Error('Formula evaluation failed: Formula exceeds maximum allowed length');
    }

    try {
      const tokens = tokenize(formula);
      const parser = new FormulaParser(tokens);
      const ast = parser.parse();
      const result = evaluateAst(ast, context || {});
      if (typeof result === 'number' && !Number.isFinite(result)) {
        throw new Error('Formula result is not a finite number');
      }
      return result;
    } catch (err) {
      throw new Error(`Formula evaluation failed: ${err.message}`);
    }
  }
}

module.exports = { ContractEngine };
