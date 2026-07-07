const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'A valid email is required';
  }
  if (!EMAIL_RE.test(email.trim())) {
    return 'Invalid email format';
  }
  return null;
}

export function validatePassword(password, { forRegistration = false } = {}) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (forRegistration) {
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must include at least one letter and one number';
    }
  }

  return null;
}

export function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  return null;
}

export { BCRYPT_ROUNDS };
