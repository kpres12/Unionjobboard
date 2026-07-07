import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authRequired, formatUser, normalizeRole } from '../middleware/auth.js';
import {
  BCRYPT_ROUNDS,
  validateEmail,
  validateName,
  validatePassword,
} from '../utils/auth.js';
import { createResetToken, hashResetToken, sendPasswordResetEmail } from '../utils/email.js';

const router = Router();

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

router.post('/register', (req, res) => {
  const { email, password, name, role } = req.body;

  const nameError = validateName(name);
  if (nameError) return res.status(400).json({ error: nameError });

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ error: emailError });

  const passwordError = validatePassword(password, { forRegistration: true });
  if (passwordError) return res.status(400).json({ error: passwordError });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const result = db
    .prepare(
      'INSERT INTO users (email, password_hash, name, auth_provider, role) VALUES (?, ?, ?, ?, ?)'
    )
    .run(normalizedEmail, passwordHash, name.trim(), 'local', normalizeRole(role));

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const user = formatUser(row);
  const token = signToken(user);

  res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ error: 'Invalid email or password' });

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: 'Invalid email or password' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (row.auth_provider !== 'local') {
    return res.status(400).json({
      error: `This account uses ${row.auth_provider} sign-in. Please use that method instead.`,
    });
  }

  if (!bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = formatUser(row);
  const token = signToken(user);

  res.json({ user, token });
});

router.get('/me', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: formatUser(row) });
});

router.put('/password', authRequired, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  const passwordError = validatePassword(newPassword, { forRegistration: true });
  if (passwordError) return res.status(400).json({ error: passwordError });

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row || row.auth_provider !== 'local' || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.id);

  res.json({ success: true });
});

router.put('/role', authRequired, (req, res) => {
  const { role } = req.body;
  const normalizedRole = normalizeRole(role);

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(normalizedRole, req.user.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: formatUser(row) });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const emailError = validateEmail(email);
  if (emailError) return res.status(400).json({ error: emailError });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  if (row && row.auth_provider === 'local') {
    const { token, tokenHash } = createResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(
      row.id
    );

    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(row.id, tokenHash, expiresAt);

    const result = await sendPasswordResetEmail(row.email, token);

    if (result.devMode) {
      return res.json({
        success: true,
        message: 'Password reset link generated. Check the server console in development.',
        devResetUrl: result.resetUrl,
      });
    }
  }

  res.json({
    success: true,
    message: 'If an account exists with that email, a reset link has been sent.',
  });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const passwordError = validatePassword(newPassword, { forRegistration: true });
  if (passwordError) return res.status(400).json({ error: passwordError });

  const tokenHash = hashResetToken(token);
  const resetRow = db
    .prepare(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')`
    )
    .get(tokenHash);

  if (!resetRow) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, resetRow.user_id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetRow.id);

  res.json({ success: true, message: 'Password updated. You can now sign in.' });
});

export default router;
