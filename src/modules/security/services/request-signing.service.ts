/**
 * Request Signing Verification Service
 * Verifies request signatures for additional security
 * 
 * @module Security
 */

import crypto from 'crypto';

export interface SigningConfig {
  secret: string;
  algorithm?: string;
  headerName?: string;
}

export class RequestSigningService {
  constructor(private readonly config: SigningConfig) {
    this.config.algorithm = config.algorithm || 'sha256';
    this.config.headerName = config.headerName || 'x-signature';
  }

  /**
   * Generate signature for request
   */
  generateSignature(payload: string | Buffer, timestamp?: number): string {
    const ts = timestamp || Date.now();
    const message = `${ts}.${payload}`;
    const hmac = crypto.createHmac(this.config.algorithm!, this.config.secret);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * Verify request signature
   */
  verifySignature(
    payload: string | Buffer,
    signature: string,
    timestamp: number,
    maxAge: number = 300000 // 5 minutes default
  ): boolean {
    // Check timestamp age
    const age = Date.now() - timestamp;
    if (age > maxAge) {
      return false; // Request too old
    }

    if (age < 0) {
      return false; // Timestamp in future
    }

    // Generate expected signature
    const expectedSignature = this.generateSignature(payload, timestamp);

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Extract signature from request headers
   */
  extractSignature(headers: Record<string, string | string[] | undefined>): {
    signature: string;
    timestamp: number;
  } | null {
    const signatureHeader = headers[this.config.headerName!] || headers['x-signature'];
    const timestampHeader = headers['x-timestamp'] || headers['x-request-timestamp'];

    if (!signatureHeader || !timestampHeader) {
      return null;
    }

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = parseInt(
      Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader,
      10
    );

    if (!signature || isNaN(timestamp)) {
      return null;
    }

    return { signature, timestamp };
  }

  /**
   * Verify request signature from headers
   */
  verifyRequestSignature(
    payload: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
    maxAge?: number
  ): boolean {
    const extracted = this.extractSignature(headers);
    if (!extracted) {
      return false;
    }

    return this.verifySignature(payload, extracted.signature, extracted.timestamp, maxAge);
  }
}

