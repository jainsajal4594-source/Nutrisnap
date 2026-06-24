const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, goal: user.goal, plan: user.plan || 'free' };
}

router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are all required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists — try logging in instead.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = db.createUser({ name: name.trim(), email: email.trim(), passwordHash });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;