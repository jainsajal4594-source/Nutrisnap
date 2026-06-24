require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./src/routes/auth');
const diaryRoutes = require('./src/routes/diary');
const aiRoutes = require('./src/routes/ai');

const app = express();

app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/ai', aiRoutes);

// Admin page — password protected
app.get('/admin', (req, res) => {
  const auth = req.headers['authorization'];
  const expected = 'Basic ' + Buffer.from('admin:nutrisnap@2024').toString('base64');
  if (auth !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Access denied');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NutriSnap server running at http://localhost:${PORT}`);
});

