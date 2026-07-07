import crypto from 'crypto';
import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const subject = 'Reset your Haymarket password';
  const text = `Reset your password by visiting:\n\n${resetUrl}\n\nThis link expires in 1 hour.`;
  const html = `
    <p>Reset your password by clicking the link below:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
  `;

  const transporter = getTransporter();

  if (!transporter) {
    console.log('\n--- Password reset (dev mode) ---');
    console.log(`To: ${email}`);
    console.log(`Link: ${resetUrl}`);
    console.log('---------------------------------\n');
    return { devMode: true, resetUrl };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@haymarket.jobs',
    to: email,
    subject,
    text,
    html,
  });

  return { devMode: false };
}
