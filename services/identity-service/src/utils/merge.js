/**
 * Deep merge utility for customer KYC and metadata enrichment.
 * Merges properties of source into target recursively.
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') {
    return target;
  }

  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], val);
    } else {
      target[key] = val;
    }
  }

  return target;
}

module.exports = { deepMerge };
