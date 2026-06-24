const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE_NAME = 'nutrisnap_token';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with "undefined".
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Attaches req.user if a valid cookie is present; does NOT block the request
// if it's missing. Use this on routes that work for both guests and members
// (e.g. the AI proxy).
function optionalAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(payload.sub);
    if (user) req.user = user;
  } catch (err) {
    // Invalid/expired token — treat as a guest rather than erroring.
  }
  next();
}

// Blocks the request with 401 if there's no valid session.
function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    next();
  });
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, optionalAuth, requireAuth, COOKIE_NAME };