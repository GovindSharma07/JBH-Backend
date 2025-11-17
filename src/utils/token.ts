import crypto from 'crypto';

// Generates a long, secure, random hex string for links
export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Generates a simple 6-digit numeric code for SMS/Phone
export const generateNumericCode = (digits: number = 6): string => {
  const max = 10 ** digits - 1;
  const min = 10 ** (digits - 1);
  return crypto.randomInt(min, max + 1).toString();
};