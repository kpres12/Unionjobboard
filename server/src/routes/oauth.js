import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  exchangeAppleCode,
  exchangeGoogleCode,
  findOrCreateOAuthUser,
  getAppleAuthUrl,
  getGoogleAuthUrl,
  isAppleConfigured,
  isGoogleConfigured,
  verifyAppleToken,
  verifyGoogleToken,
} from '../utils/oauth.js';

const router = Router();
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

function oauthRedirect(token, error) {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (error) params.set('error', error);
  return `${APP_URL}/auth/callback?${params.toString()}`;
}

function createOAuthState(role) {
  return jwt.sign({ role, nonce: crypto.randomUUID() }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '10m',
  });
}

router.get('/google/start', (req, res) => {
  try {
    const role = req.query.role || 'seeker';
    const state = createOAuthState(role);
    const url = getGoogleAuthUrl(state);
    res.redirect(url);
  } catch (error) {
    res.redirect(oauthRedirect(null, error.message));
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(oauthRedirect(null, 'Google sign-in was cancelled'));
    }

    if (!code || !state) {
      return res.redirect(oauthRedirect(null, 'Missing Google authorization data'));
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET || 'dev-secret');
    const profile = await exchangeGoogleCode(code);

    const user = findOrCreateOAuthUser({
      provider: 'google',
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      role: decoded.role,
    });

    const token = signToken(user);
    res.redirect(oauthRedirect(token));
  } catch (err) {
    res.redirect(oauthRedirect(null, err.message || 'Google sign-in failed'));
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const profile = await verifyGoogleToken(idToken);
    const user = findOrCreateOAuthUser({
      provider: 'google',
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      role,
    });

    const token = signToken(user);
    res.json({ user, token });
  } catch (error) {
    res.status(401).json({ error: error.message || 'Google sign-in failed' });
  }
});

router.post('/apple', async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Apple ID token is required' });
    }

    const profile = await verifyAppleToken(idToken);
    const user = findOrCreateOAuthUser({
      provider: 'apple',
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      role,
    });

    const token = signToken(user);
    res.json({ user, token });
  } catch (error) {
    res.status(401).json({ error: error.message || 'Apple sign-in failed' });
  }
});

router.get('/apple/start', (req, res) => {
  try {
    const role = req.query.role || 'seeker';
    const state = createOAuthState(role);
    const url = getAppleAuthUrl(state);
    res.redirect(url);
  } catch (error) {
    res.redirect(oauthRedirect(null, error.message));
  }
});

router.post('/apple/callback', async (req, res) => {
  try {
    const { code, state, user: appleUser } = req.body;

    if (!code || !state) {
      return res.redirect(oauthRedirect(null, 'Apple sign-in was cancelled'));
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET || 'dev-secret');
    const profile = await exchangeAppleCode(code);

    let name = profile.name;
    if (appleUser) {
      try {
        const parsed = typeof appleUser === 'string' ? JSON.parse(appleUser) : appleUser;
        const fullName = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ');
        if (fullName) name = fullName;
      } catch {
        // ignore parse errors
      }
    }

    const user = findOrCreateOAuthUser({
      provider: 'apple',
      providerId: profile.providerId,
      email: profile.email,
      name,
      role: decoded.role,
    });

    const token = signToken(user);
    res.redirect(oauthRedirect(token));
  } catch (error) {
    res.redirect(oauthRedirect(null, error.message || 'Apple sign-in failed'));
  }
});

router.get('/providers', (_req, res) => {
  res.json({
    google: isGoogleConfigured(),
    apple: isAppleConfigured(),
  });
});

export default router;
