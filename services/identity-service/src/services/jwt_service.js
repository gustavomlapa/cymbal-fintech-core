const crypto = require('node:crypto');

class JwtService {
  constructor() {
    // Generate RSA 2048-bit key pair on startup
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    this.publicKeyPEM = publicKey;
    this.privateKeyPEM = privateKey;
  }

  createToken(payload, expiresInSeconds = 3600) {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp, iss: 'cymbal-identity-service' };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(dataToSign);
    signer.end();
    const signature = signer.sign(this.privateKeyPEM).toString('base64url');

    return `${dataToSign}.${signature}`;
  }

  /**
   * Verifies an incoming JWT token with strict RS256 asymmetric signature verification.
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token string');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed token structure');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }

    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    if (header.alg !== 'RS256') {
      throw new Error(`Unsupported or invalid token algorithm: ${header.alg}`);
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataToSign);
    verifier.end();
    const isValid = verifier.verify(this.publicKeyPEM, Buffer.from(signature, 'base64url'));
    if (!isValid) {
      throw new Error('Invalid RSA signature');
    }

    return payload;
  }
}

module.exports = { JwtService };

