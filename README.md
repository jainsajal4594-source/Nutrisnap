NutriSnap
A small Express server that turns the static NutriSnap demo into a real app — with real auth, server-side diary persistence, and a secured Gemini AI proxy.
🔗 Live demo: spectacular-mousse-253b6d.netlify.app
---
Features
Auth — signup/login/logout with hashed passwords (bcrypt) and an httpOnly session cookie (JWT). No passwords or tokens ever touch `localStorage`.
Diary persistence — logged-in users' meal diary and calorie goal are stored server-side and survive across devices/sessions. Guests get a diary that works immediately but only lives in memory for that page visit (matches the original "try it instantly, sign up to save" UX).
AI proxy — your Gemini API key lives only in this server's `.env` file. The browser never sees it; it calls `/api/ai/...` and the server forwards the request to Gemini.
---
1. Install
Requires Node.js 18 or newer (for built-in `fetch` and `crypto.randomUUID`).
```bash
cd nutrisnap-app
npm install
```
2. Configure
```bash
cp .env.example .env
```
Then edit `.env`:
Variable	Description
`GEMINI_API_KEY`	Get a free one at aistudio.google.com/apikey
`JWT_SECRET`	Any long random string. Generate one with:<br>`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
`PORT`	Defaults to `3000`
`NODE_ENV`	Leave as `development` locally; set to `production` when deployed (makes session cookies secure, i.e. HTTPS-only)
3. Run
```bash
npm start
```
Visit http://localhost:3000 — the frontend (`public/index.html`) and the API are served from the same server, so there's nothing else to wire up.
For auto-restart on file changes during development:
```bash
npm run dev
```
---
How data is stored
`src/db.js` is a tiny JSON-file database (`data/db.json`), created automatically on first run. It's fine for a demo or a small number of users, but:
It is not safe for concurrent production traffic (no locking, no transactions).
Most hosting platforms wipe the local filesystem on every deploy (Render, Railway, Vercel, Fly.io's ephemeral volumes, etc.), so `data/db.json` will reset unless you mount a persistent volume or — better — swap in a real database.
Every other file talks to storage only through the functions exported by `db.js` (`createUser`, `getDiary`, `addMeal`, etc.), so migrating to Postgres/MySQL/MongoDB later just means rewriting that one file.
---
API summary
Method	Path	Auth required	Purpose
POST	`/api/auth/signup`	no	Create account, starts a session
POST	`/api/auth/login`	no	Log in, starts a session
POST	`/api/auth/logout`	no	Clear the session cookie
GET	`/api/auth/me`	yes	Get the logged-in user
GET	`/api/diary`	yes	Get today's diary + goal
POST	`/api/diary/meals`	yes	Add a meal
DELETE	`/api/diary/meals/:id`	yes	Remove a meal
PUT	`/api/diary/goal`	yes	Update daily calorie goal
POST	`/api/ai/analyze-food`	no (rate-limited)	Analyze a food photo
POST	`/api/ai/chat`	no (rate-limited)	Chat with the nutrition assistant
The AI routes are intentionally open to guests (same as the original demo) but capped at 30 requests/hour per IP (see `src/middleware/rateLimit.js`) so a public deployment can't be used to silently burn through your Gemini quota. Tighten this, or change `optionalAuth` to `requireAuth` in `src/routes/ai.js` if you'd rather only logged-in users get AI access.
---
Deploying
Any Node host works (Render, Railway, Fly.io, a VPS, etc.):
Push this folder to your host.
Set `GEMINI_API_KEY`, `JWT_SECRET`, and `NODE_ENV=production` as environment variables in the host's dashboard (don't commit `.env`).
Build/start command: `npm install && npm start`.
If your host supports persistent disks/volumes, mount one at `./data` so `db.json` survives redeploys — otherwise plan to migrate to a real database before relying on this for real users.
---
Things worth doing before real production use
Swap `src/db.js` for a real database (Postgres is a solid default).
Resize/compress photos client-side before upload — right now a full-res phone photo is sent as base64, which is slower and uses more of your Gemini quota than necessary.
Add email verification / password-reset flows if you want this to be a real consumer auth system rather than a demo-grade one.
Consider moving the in-memory rate limiter to Redis if you ever run more than one server instance.
---
Tech stack (extended: MongoDB + React + Razorpay)
The core app above ships with the file-based `db.js` store and a static HTML/JS frontend. If you want to run NutriSnap as a production app with a real database, a React frontend, and paid premium plans, here's how each piece fits in.
Stack:
Express — REST API (same routes as above)
MongoDB (Mongoose) — replaces `src/db.js`, stores users, diary entries, and subscriptions
React — replaces `public/index.html` with a component-based SPA
Razorpay — handles payment for a premium subscription tier
1. MongoDB — models
```bash
npm install mongoose
```
`src/config/db.js` — connection:
```js
// src/config/db.js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = connectDB;
```
`src/models/User.js`:
```js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  dailyGoal: { type: Number, default: 2000 },
  isPremium: { type: Boolean, default: false },
  razorpayCustomerId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
```
`src/models/Meal.js`:
```js
const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  calories: { type: Number, required: true },
  protein: Number,
  carbs: Number,
  fat: Number,
  loggedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Meal', mealSchema);
```
`src/models/Payment.js`:
```js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
```
Wire it up in `src/server.js`:
```js
const connectDB = require('./config/db');
connectDB();
```
Add to `.env`:
```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nutrisnap
```
2. Razorpay — payments
```bash
npm install razorpay
```
Add to `.env`:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
```
`src/config/razorpay.js`:
```js
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;
```
`src/routes/payments.js` — create an order, then verify the signature after checkout:
```js
const express = require('express');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Create a Razorpay order for the premium plan
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const amount = 49900; // ₹499.00, in paise
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${req.user._id}_${Date.now()}`,
    });

    await Payment.create({
      user: req.user._id,
      razorpayOrderId: order.id,
      amount,
      status: 'created',
    });

    res.json({ orderId: order.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment signature after Razorpay checkout completes client-side
router.post('/verify', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  await Payment.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    { razorpayPaymentId: razorpay_payment_id, status: 'paid' }
  );
  await User.findByIdAndUpdate(req.user._id, { isPremium: true });

  res.json({ success: true });
});

module.exports = router;
```
Mount it in `src/server.js`:
```js
app.use('/api/payments', require('./routes/payments'));
```
Never verify a payment by trusting the client alone — always recompute the HMAC signature server-side with your `RAZORPAY_KEY_SECRET`, as shown above, before marking a user as premium.
3. React — frontend
If you replace the static `public/` frontend with React (e.g. via Vite), the API calls stay the same; only the checkout trigger changes.
```bash
npm create vite@latest nutrisnap-frontend -- --template react
cd nutrisnap-frontend
npm install axios
```
`src/api/client.js`:
```js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // sends the httpOnly session cookie
});

export default api;
```
`src/components/UpgradeButton.jsx` — loads the Razorpay checkout script and starts a payment:
```jsx
import { useEffect } from 'react';
import api from '../api/client';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradeButton() {
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  async function handleUpgrade() {
    const { data: order } = await api.post('/payments/create-order');

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'NutriSnap Premium',
      description: 'Unlock unlimited AI food analysis',
      handler: async (response) => {
        await api.post('/payments/verify', response);
        alert('You are now a Premium member!');
      },
      theme: { color: '#22c55e' },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  return <button onClick={handleUpgrade}>Upgrade to Premium — ₹499</button>;
}
```
`src/components/Diary.jsx` — a minimal example of fetching/adding meals from MongoDB-backed routes:
```jsx
import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Diary() {
  const [diary, setDiary] = useState(null);

  useEffect(() => {
    api.get('/diary').then((res) => setDiary(res.data));
  }, []);

  async function addMeal(name, calories) {
    const { data } = await api.post('/diary/meals', { name, calories });
    setDiary(data);
  }

  if (!diary) return <p>Loading…</p>;

  return (
    <div>
      <h2>Today's meals — goal {diary.goal} kcal</h2>
      <ul>
        {diary.meals.map((m) => (
          <li key={m._id}>{m.name} — {m.calories} kcal</li>
        ))}
      </ul>
    </div>
  );
}
```
4. Express — tying it together
`src/server.js` with all pieces mounted:
```js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(express.json({ limit: '10mb' })); // allow base64 food photos
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/diary', require('./routes/diary'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payments', require('./routes/payments'));

// Serve the React build in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../nutrisnap-frontend/dist')));
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, '../nutrisnap-frontend/dist/index.html'))
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NutriSnap running on port ${PORT}`));
```
5. Updated `.env.example`
```
# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Auth
JWT_SECRET=

# Database
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nutrisnap

# AI
GEMINI_API_KEY=

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```
Notes on this stack
Razorpay test mode uses key IDs prefixed `rzp_test_` — switch to `rzp_live_` only once you've completed KYC in the Razorpay dashboard.
Amounts are always in the smallest currency unit (paise for INR), so ₹499 is `49900`.
Signature verification (`/payments/verify`) must happen server-side; the `Razorpay` checkout modal on the client only initiates payment, it never confirms it.
With Mongoose in place, `src/db.js` and `data/db.json` are no longer needed — delete them once the migration is complete.
