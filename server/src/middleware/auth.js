import jwt from 'jsonwebtoken';
import db from '../db.js';

export { formatUser, normalizeRole, VALID_ROLES } from '../utils/user.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch {
    req.user = null;
  }

  next();
}

export function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!user?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}
