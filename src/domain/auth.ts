export const MAX_ATTEMPTS = 5;

/**
 * Client-side mirror of the lockout rule for UI feedback only.
 * Lockout MUST be enforced server-side, and PINs hashed with bcrypt/Argon2 — FR-AUTH-02.
 */
export function registerFailure(failedAttempts: number) {
  const n = failedAttempts + 1;
  if (n >= MAX_ATTEMPTS) {
    return { failedAttempts: 0, notice: 'Account locked for 15 minutes after 5 consecutive failed attempts · FR-AUTH-02, TC-11', locked: true };
  }
  return { failedAttempts: n, notice: `Incorrect PIN. A PIN is 4–6 digits. Attempt ${n} of ${MAX_ATTEMPTS}.`, locked: false };
}
