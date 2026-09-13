import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private keyBuffer: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // Standard 96-bit IV for GCM
  private readonly tagLength = 16; // Standard 128-bit auth tag for GCM

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initKey();
  }

  /**
   * Initializes and validates the 256-bit encryption key.
   */
  public initKey(customKey?: string): void {
    const rawKey =
      customKey ||
      this.configService?.get<string>('GITHUB_TOKEN_ENCRYPTION_KEY') ||
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

    if (!rawKey) {
      throw new Error(
        'SECURITY ERROR: GITHUB_TOKEN_ENCRYPTION_KEY is not defined. A 32-byte encryption key is required.',
      );
    }

    // Key can be provided as a 64-character hex string or 32-byte raw string / base64
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      this.keyBuffer = Buffer.from(rawKey, 'hex');
    } else if (Buffer.from(rawKey, 'utf-8').length === 32) {
      this.keyBuffer = Buffer.from(rawKey, 'utf-8');
    } else if (Buffer.from(rawKey, 'base64').length === 32) {
      this.keyBuffer = Buffer.from(rawKey, 'base64');
    } else {
      throw new Error(
        `SECURITY ERROR: GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Provided key has invalid length.`,
      );
    }

    this.logger.log('CryptoService initialized with validated AES-256-GCM key.');
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh, cryptographically random IV.
   * Returns serialized format: `iv:authTag:encryptedData` (hex-encoded).
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }
    if (!this.keyBuffer) {
      this.initKey();
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv, {
      authTagLength: this.tagLength,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    return `${ivHex}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext formatted as `iv:authTag:encryptedData` using AES-256-GCM.
   * Verifies the cryptographic authentication tag before returning plaintext.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }
    if (!this.keyBuffer) {
      this.initKey();
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected iv:authTag:data');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== this.ivLength || authTag.length !== this.tagLength) {
      throw new Error('Invalid IV or auth tag length in ciphertext');
    }

    const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv, {
      authTagLength: this.tagLength,
    });

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Constant-time comparison between two strings to prevent timing attacks.
   */
  timingSafeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
    if (!a || !b) {
      return false;
    }

    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }
}
