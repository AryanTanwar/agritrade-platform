'use strict';

const {
  hashPassword,
  verifyPassword,
  generateOTP,
  generateToken,
  hmacSign,
  hmacVerify,
} = require('../../shared/crypto/hashUtils');

describe('Password hashing (bcrypt)', () => {

  test('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword('MySecret@123!');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  test('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('CorrectPassword#99');
    expect(await verifyPassword('CorrectPassword#99', hash)).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('RealPassword$1');
    expect(await verifyPassword('WrongPassword$1', hash)).toBe(false);
  });

  test('verifyPassword returns false for empty inputs', async () => {
    expect(await verifyPassword('', 'somehash')).toBe(false);
    expect(await verifyPassword('pass', '')).toBe(false);
  });

  test('same password produces different hashes (salted)', async () => {
    const h1 = await hashPassword('SamePass!1');
    const h2 = await hashPassword('SamePass!1');
    expect(h1).not.toBe(h2);
  });
});

describe('generateOTP', () => {
  test('generates a 6-digit numeric string by default', () => {
    const otp = generateOTP();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  test('generates OTP of specified length', () => {
    expect(generateOTP(4)).toHaveLength(4);
    expect(generateOTP(8)).toHaveLength(8);
  });
});

describe('generateToken', () => {
  test('returns a hex string of expected length', () => {
    const tok = generateToken(32);
    expect(tok).toHaveLength(64);
  });

  test('each token is unique', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('HMAC signing', () => {
  const SECRET = 'test-webhook-secret';
  const DATA   = '{"event":"order.created","orderId":"abc123"}';

  test('hmacSign returns a hex string', () => {
    const sig = hmacSign(DATA, SECRET);
    expect(typeof sig).toBe('string');
    expect(/^[a-f0-9]+$/.test(sig)).toBe(true);
  });

  test('hmacVerify returns true for valid signature', () => {
    const sig = hmacSign(DATA, SECRET);
    expect(hmacVerify(DATA, SECRET, sig)).toBe(true);
  });

  test('hmacVerify returns false for tampered data', () => {
    const sig = hmacSign(DATA, SECRET);
    expect(hmacVerify(DATA + 'tampered', SECRET, sig)).toBe(false);
  });

  test('hmacVerify returns false for wrong secret', () => {
    const sig = hmacSign(DATA, SECRET);
    expect(hmacVerify(DATA, 'wrong-secret', sig)).toBe(false);
  });
});
