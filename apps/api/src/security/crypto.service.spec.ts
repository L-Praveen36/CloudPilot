import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import * as crypto from 'crypto';

describe('CryptoService', () => {
  let service: CryptoService;
  const validHexKey = crypto.randomBytes(32).toString('hex'); // 64 hex chars = 32 bytes

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GITHUB_TOKEN_ENCRYPTION_KEY') {
                return validHexKey;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    service.onModuleInit();
  });

  it('should be defined and initialized with valid key', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const plaintext = 'gho_mock_access_token_12345';
    const ciphertext = service.encrypt(plaintext);

    expect(ciphertext).toBeDefined();
    const parts = ciphertext.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12 bytes = 24 hex chars
    expect(parts[1].length).toBe(32); // 16 bytes = 32 hex chars
    expect(parts[2].length).toBeGreaterThan(0);
    expect(ciphertext).not.toContain(plaintext);
  });

  it('should produce unique IV and ciphertext for identical plaintexts (IND-CPA)', () => {
    const plaintext = 'gho_secret_token';
    const cipher1 = service.encrypt(plaintext);
    const cipher2 = service.encrypt(plaintext);

    expect(cipher1).not.toEqual(cipher2);
    expect(service.decrypt(cipher1)).toEqual(plaintext);
    expect(service.decrypt(cipher2)).toEqual(plaintext);
  });

  it('should successfully decrypt ciphertext back to original plaintext', () => {
    const token = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = service.encrypt(token);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(token);
  });

  it('should throw error when decrypting tampered ciphertext (authenticated encryption)', () => {
    const plaintext = 'gho_secure_token';
    const ciphertext = service.encrypt(plaintext);
    const parts = ciphertext.split(':');

    // Tamper with the encrypted data
    const tamperedData =
      parts[2].substring(0, parts[2].length - 2) +
      (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tamperedData}`;

    expect(() => service.decrypt(tamperedCiphertext)).toThrow();
  });

  it('should throw error when decrypting tampered auth tag', () => {
    const plaintext = 'gho_secure_token';
    const ciphertext = service.encrypt(plaintext);
    const parts = ciphertext.split(':');

    // Tamper with auth tag
    const tamperedTag =
      parts[1].substring(0, parts[1].length - 2) +
      (parts[1].endsWith('0') ? '1' : '0');
    const tamperedCiphertext = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => service.decrypt(tamperedCiphertext)).toThrow();
  });

  it('should throw error on invalid key length', () => {
    const invalidService = new CryptoService({
      get: () => 'short_key',
    } as any);

    expect(() => invalidService.onModuleInit()).toThrow(
      /GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes/,
    );
  });

  it('should throw error when encryption key is missing', () => {
    const invalidService = new CryptoService({
      get: () => undefined,
    } as any);

    expect(() => invalidService.initKey('')).toThrow(
      /GITHUB_TOKEN_ENCRYPTION_KEY is not defined/,
    );
  });

  it('should perform timing-safe string comparison correctly', () => {
    const secretA = 'abcdef123456';
    const secretB = 'abcdef123456';
    const secretC = 'abcdef123457';

    expect(service.timingSafeEqual(secretA, secretB)).toBe(true);
    expect(service.timingSafeEqual(secretA, secretC)).toBe(false);
    expect(service.timingSafeEqual(secretA, null)).toBe(false);
    expect(service.timingSafeEqual(null, null)).toBe(false);
    expect(service.timingSafeEqual('short', 'longerstring')).toBe(false);
  });
});
