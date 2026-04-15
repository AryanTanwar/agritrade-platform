'use strict';

process.env.AES_ENCRYPTION_KEY = '0'.repeat(64); // test key — 64 hex chars (32 bytes)

const { encrypt, decrypt, sha256Hash, safeCompare, randomToken } = require('../../shared/crypto/aes256');

describe('AES-256-GCM encryption', () => {

  test('encrypts a string and returns a base64 payload', () => {
    const plaintext = 'sensitive-aadhaar-data';
    const encrypted = encrypt(plaintext);
    expect(typeof encrypted).toBe('string');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    expect(encrypted).not.toContain(plaintext); // sanity: not plaintext
  });

  test('decrypts back to the original plaintext', () => {
    const plaintext = 'hello agritrade platform';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  test('different calls produce different ciphertexts (random IV)', () => {
    const plaintext = 'same input';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  test('decrypt throws on tampered ciphertext', () => {
    const encrypted = encrypt('legitimate data');
    const buf = Buffer.from(encrypted, 'base64');
    buf[buf.length - 1] ^= 0xFF; // flip last byte (auth tag)
    expect(() => decrypt(buf.toString('base64'))).toThrow();
  });

  test('throws on non-string input', () => {
    expect(() => encrypt(123)).toThrow(TypeError);
    expect(() => encrypt(null)).toThrow(TypeError);
  });
});

describe('sha256Hash', () => {
  test('produces a 64-char hex string', () => {
    const hash = sha256Hash('test');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test('is deterministic', () => {
    expect(sha256Hash('abc')).toBe(sha256Hash('abc'));
  });

  test('different inputs produce different hashes', () => {
    expect(sha256Hash('abc')).not.toBe(sha256Hash('xyz'));
  });
});

describe('safeCompare', () => {
  test('returns true for equal strings', () => {
    expect(safeCompare('secret', 'secret')).toBe(true);
  });

  test('returns false for different strings of same length', () => {
    expect(safeCompare('aaaa', 'aaab')).toBe(false);
  });

  test('returns false for different lengths', () => {
    expect(safeCompare('short', 'longerstring')).toBe(false);
  });
});

describe('randomToken', () => {
  test('returns a hex string of correct length', () => {
    const tok = randomToken(32);
    expect(tok).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[a-f0-9]+$/.test(tok)).toBe(true);
  });

  test('each call returns a unique token', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
