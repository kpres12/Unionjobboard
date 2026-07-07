import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import db from '../db.js';
import { formatUser, normalizeRole } from '../utils/user.js';
import { BCRYPT_ROUNDS } from '../utils/auth.js';

function getGoogleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return null;
  }

  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3001/api/auth/oauth/google/callback'
  );
}

function oauthPlaceholderHash() {
  return bcrypt.hashSync(crypto.randomUUID(), BCRYPT_ROUNDS);
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isAppleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  );
}

export function findOrCreateOAuthUser({ provider, providerId, email, name, role }) {
  const normalizedRole = normalizeRole(role);
  const normalizedEmail = email.trim().toLowerCase();

  const idColumn = provider === 'google' ? 'google_id' : 'apple_id';
  const byProvider = db.prepare(`SELECT * FROM users WHERE ${idColumn} = ?`).get(providerId);
  if (byProvider) return formatUser(byProvider);

  const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (byEmail) {
    db.prepare(
      `UPDATE users SET ${idColumn} = ?, auth_provider = ?, name = ? WHERE id = ?`
    ).run(providerId, provider, name || byEmail.name, byEmail.id);

    if (byEmail.role === 'seeker' && normalizedRole !== 'seeker') {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(normalizedRole, byEmail.id);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
    return formatUser(updated);
  }

  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, auth_provider, ${idColumn}, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      normalizedEmail,
      oauthPlaceholderHash(),
      name || normalizedEmail.split('@')[0],
      provider,
      providerId,
      normalizedRole
    );

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  return formatUser(row);
}

export function getGoogleAuthUrl(state) {
  const client = getGoogleOAuthClient();
  if (!client) {
    throw new Error('Google sign-in is not configured on the server');
  }

  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
}

export async function exchangeGoogleCode(code) {
  const client = getGoogleOAuthClient();
  if (!client) {
    throw new Error('Google sign-in is not configured on the server');
  }

  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error('Google did not return an ID token');
  }

  return verifyGoogleToken(tokens.id_token);
}

export async function verifyGoogleToken(idToken) {
  const client = getGoogleOAuthClient();
  if (!client) {
    throw new Error('Google sign-in is not configured on the server');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new Error('Invalid Google token');
  }

  return {
    providerId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
  };
}

export async function verifyAppleToken(idToken) {
  if (!process.env.APPLE_CLIENT_ID) {
    throw new Error('Apple sign-in is not configured on the server');
  }

  const payload = await appleSignin.verifyIdToken(idToken, {
    audience: process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });

  if (!payload.sub) {
    throw new Error('Invalid Apple token');
  }

  return {
    providerId: payload.sub,
    email: payload.email || `apple-${payload.sub.slice(0, 8)}@privaterelay.appleid.com`,
    name: 'Apple User',
  };
}

export function getAppleAuthUrl(state) {
  if (!isAppleConfigured() || !process.env.APPLE_REDIRECT_URI) {
    throw new Error('Apple sign-in is not configured on the server');
  }

  return appleSignin.getAuthorizationUrl({
    clientID: process.env.APPLE_CLIENT_ID,
    redirectUri: process.env.APPLE_REDIRECT_URI,
    state,
    responseMode: 'form_post',
    scope: 'name email',
  });
}

export async function exchangeAppleCode(code) {
  const clientSecret = appleSignin.getClientSecret({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    keyIdentifier: process.env.APPLE_KEY_ID,
  });

  const tokens = await appleSignin.getAuthorizationToken(code, {
    clientID: process.env.APPLE_CLIENT_ID,
    redirectUri: process.env.APPLE_REDIRECT_URI,
    clientSecret,
  });

  return verifyAppleToken(tokens.id_token);
}
