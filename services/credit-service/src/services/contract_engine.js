const ALLOWED_MATH_FUNCS = ['min', 'max', 'pow', 'sqrt', 'abs', 'round', 'floor', 'ceil', 'log', 'exp'];
const ALLOWED_MATH_CONSTANTS = { PI: Math.PI, E: Math.E };
const MATH_FUNCS = {
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  log: Math.log,
  exp: Math.exp
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
        numStr += input[i];
        i++;
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        numStr += input[i];
        i++;
        if (i < len && (input[i] === '+' || input[i] === '-')) {
          numStr += input[i];
          i++;
        }
        while (i < len && /\d/.test(input[i])) {
          numStr += input[i];
          i++;
        }
      }
      const num = Number(numStr);
      if (Number.isNaN(num)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_$]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    const three = input.slice(i, i + 3);
    if (three === '===' || three === '!==') {
      tokens.push({ type: 'OP', value: three });
      i += 3;
      continue;
    }

    const two = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '**'].includes(two)) {
      tokens.push({ type: 'OP', value: two });
      i += 2;
      continue;
    }

    if (['+', '-', '*', '/', '%', '<', '>', '!', '?', ':', '(', ')', ',', '.'].includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${ch}'`);
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

class FormulaParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(val) {
    const token = this.tokens[this.pos];
    if (val !== undefined && token.value !== val) {
      throw new Error(`Expected '${val}', got '${token.value}'`);
    }
    this.pos++;
    return token;
  }

  parse() {
    const expr = this.parseConditional(0);
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token '${this.peek().value}' after expression`);
    }
    return expr;
  }

  parseConditional(depth) {
    if (depth > 50) throw new Error('Expression nesting depth limit exceeded');
    const test = this.parseLogicalOr(depth);
    if (this.peek().value === '?') {
      this.consume('?');
      const consequent = this.parseConditional(depth + 1);
      this.consume(':');
      const alternate = this.parseConditional(depth + 1);
      return { type: 'ConditionalExpression', test, consequent, alternate };
    }
    return test;
  }

  parseLogicalOr(depth) {
    let left = this.parseLogicalAnd(depth);
    while (this.peek().value === '||') {
      const op = this.consume().value;
      const right = this.parseLogicalAnd(depth + 1);
      left = { type: 'LogicalExpression', operator: op, left, right };
    }
    return left;
  }

  parseLogicalAnd(depth) {
    let left = this.parseEquality(depth);
    while (this.peek().value === '&&') {
      const op = this.consume().value;
      const right = this.parseEquality(depth + 1);
      left = { type: 'LogicalExpression', operator: op, left, right };
    }
    return left;
  }

  parseEquality(depth) {
    let left = this.parseRelational(depth);
    while (['==', '!=', '===', '!=='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseRelational(depth + 1);
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseRelational(depth) {
    let left = this.parseAdditive(depth);
    while (['<', '<=', '>', '>='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseAdditive(depth + 1);
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseAdditive(depth) {
    let left = this.parseMultiplicative(depth);
    while (['+', '-'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseMultiplicative(depth + 1);
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseMultiplicative(depth) {
    let left = this.parseExponentiation(depth);
    while (['*', '/', '%'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseExponentiation(depth + 1);
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseExponentiation(depth) {
    const left = this.parseUnary(depth);
    if (this.peek().value === '**') {
      const op = this.consume().value;
      const right = this.parseExponentiation(depth + 1);
      return { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseUnary(depth) {
    if (['+', '-', '!'].includes(this.peek().value)) {
      const op = this.consume().value;
      const argument = this.parseUnary(depth + 1);
      return { type: 'UnaryExpression', operator: op, argument };
    }
    return this.parsePrimary(depth);
  }

  parsePrimary(depth) {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'Literal', value: token.value };
    }

    if (token.value === '(') {
      this.consume('(');
      const expr = this.parseConditional(depth + 1);
      this.consume(')');
      return expr;
    }

    if (token.type === 'IDENT') {
      const ident = this.consume().value;

      if (ident === 'true') return { type: 'Literal', value: true };
      if (ident === 'false') return { type: 'Literal', value: false };

      if (ident === 'Math') {
        this.consume('.');
        const propToken = this.consume();
        if (Object.prototype.hasOwnProperty.call(ALLOWED_MATH_CONSTANTS, propToken.value)) {
          return { type: 'Literal', value: ALLOWED_MATH_CONSTANTS[propToken.value] };
        }
        if (ALLOWED_MATH_FUNCS.includes(propToken.value)) {
          return this.parseCall(propToken.value, depth);
        }
        throw new Error(`Unsupported Math property: ${propToken.value}`);
      }

      if (ALLOWED_MATH_FUNCS.includes(ident) && this.peek().value === '(') {
        return this.parseCall(ident, depth);
      }

      const allowedVars = ['amount', 'term', 'score'];
      if (allowedVars.includes(ident)) {
        return { type: 'Identifier', name: ident };
      }

      throw new Error(`Forbidden or unknown identifier: ${ident}`);
    }

    throw new Error(`Unexpected token '${token.value}'`);
  }

  parseCall(funcName, depth) {
    this.consume('(');
    const args = [];
    if (this.peek().value !== ')') {
      args.push(this.parseConditional(depth + 1));
      while (this.peek().value === ',') {
        this.consume(',');
        args.push(this.parseConditional(depth + 1));
      }
    }
    this.consume(')');
    return { type: 'CallExpression', callee: funcName, args };
  }
}

function getContextVal(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function evaluateAST(node, context, depth = 0) {
  if (depth > 50) {
    throw new Error('Expression nesting depth limit exceeded');
  }

  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier': {
      if (node.name === 'amount') return getContextVal(context.amount);
      if (node.name === 'term') return getContextVal(context.term);
      if (node.name === 'score') return getContextVal(context.score);
      throw new Error(`Unknown identifier: ${node.name}`);
    }

    case 'UnaryExpression': {
      const val = evaluateAST(node.argument, context, depth + 1);
      if (node.operator === '+') return +val;
      if (node.operator === '-') return -val;
      if (node.operator === '!') return !val;
      throw new Error(`Unsupported unary operator: ${node.operator}`);
    }

    case 'BinaryExpression': {
      const left = evaluateAST(node.left, context, depth + 1);
      const right = evaluateAST(node.right, context, depth + 1);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': {
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        }
        case '%': {
          if (right === 0) throw new Error('Division by zero');
          return left % right;
        }
        case '**': return left ** right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '==': return left == right; // eslint-disable-line eqeqeq
        case '!=': return left != right; // eslint-disable-line eqeqeq
        case '===': return left === right;
        case '!==': return left !== right;
        default:
          throw new Error(`Unsupported operator: ${node.operator}`);
      }
    }

    case 'LogicalExpression': {
      const left = evaluateAST(node.left, context, depth + 1);
      if (node.operator === '&&') {
        return left ? evaluateAST(node.right, context, depth + 1) : left;
      }
      if (node.operator === '||') {
        return left ? left : evaluateAST(node.right, context, depth + 1);
      }
      throw new Error(`Unsupported logical operator: ${node.operator}`);
    }

    case 'ConditionalExpression': {
      const test = evaluateAST(node.test, context, depth + 1);
      return test
        ? evaluateAST(node.consequent, context, depth + 1)
        : evaluateAST(node.alternate, context, depth + 1);
    }

    case 'CallExpression': {
      const fn = MATH_FUNCS[node.callee];
      if (!fn) {
        throw new Error(`Unsupported function: ${node.callee}`);
      }
      const args = node.args.map(arg => evaluateAST(arg, context, depth + 1));
      return fn(...args);
    }

    default:
      throw new Error(`Unknown AST node type: ${node.type}`);
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
   * Evaluates custom corporate rate formula adjustor.
   * Safe AST-based mathematical expression parser without dynamic code execution.
   */
  evaluateCustomRateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string') {
      return 0.0;
    }

    try {
      if (formula.length > 500) {
        throw new Error('Formula exceeds maximum allowed length');
      }
      const tokens = tokenize(formula);
      const parser = new FormulaParser(tokens);
      const ast = parser.parse();
      const result = evaluateAST(ast, context);
      if (typeof result !== 'number' && typeof result !== 'boolean') {
        throw new Error('Formula evaluation did not produce a valid numeric or boolean result');
      }
      if (typeof result === 'number' && !Number.isFinite(result)) {
        throw new Error('Formula evaluation resulted in non-finite number');
      }
      return result;
    } catch (err) {
      throw new Error(`Formula evaluation failed: ${err.message}`);
    }
  }
}

module.exports = { ContractEngine };
