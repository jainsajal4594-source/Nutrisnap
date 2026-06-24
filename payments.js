const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Amounts are in paise (smallest unit), per Razorpay's API.
const PLANS = {
  pro: { amount: 29900, label: 'NutriSnap Pro — 1 month' },
  business: { amount: 99900, label: 'NutriSnap Business — 1 month' }
};

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Server is missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET. Set them in .env.');
  }
  return new Razorpay({ key_id, key_secret });
}

// ---- Authenticated routes (mounted at /api/payments in server.js) ----

router.use(requireAuth);

// Step 1: create a Razorpay order for the chosen plan. The frontend uses
// the returned order to open Razorpay's hosted Checkout, which itself
// presents UPI, GPay, cards, netbanking, and wallets — we don't have to
// build separate UI for each payment method.
router.post('/create-order', async (req, res) => {
  try {
    const { plan } = req.body || {};
    const planDef = PLANS[plan];
    if (!planDef) return res.status(400).json({ error: 'Unknown plan.' });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: planDef.amount,
      currency: 'INR',
      receipt: `rcpt_${req.user.id}_${Date.now()}`,
      notes: { userId: req.user.id, plan }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      label: planDef.label
    });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not start checkout.' });
  }
});

// Step 2: after Checkout succeeds, the frontend calls this with the IDs +
// signature Razorpay handed back, and we verify that signature ourselves
// before trusting that the payment really happened (never trust the client
// alone for this — anyone could fake a success callback).
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !PLANS[plan]) {
      return res.status(400).json({ error: 'Missing or invalid payment details.' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature did not match — this payment could not be verified.' });
    }

    const user = db.applyPlanPayment(req.user.id, {
      plan,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: PLANS[plan].amount,
      source: 'client-verify'
    });

    res.json({ ok: true, plan: user.plan });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not confirm payment.' });
  }
});

// ---- Webhook (mounted separately in server.js, NOT behind requireAuth —
// Razorpay's own servers call this directly, authenticated by signature
// rather than a login session) ----
//
// This is a safety net: if a customer closes their browser the instant
// after paying (before the page above can call /verify), the payment would
// otherwise never get applied to their account. Razorpay still tells us
// about it here independently.
async function webhookHandler(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not set — ignoring incoming webhook.');
      return res.status(500).end();
    }
    // req.body is a raw Buffer here (see server.js) — Razorpay's signature
    // is computed over the exact raw bytes, not a re-serialized JSON object.
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (expected !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured') {
      const payment = event.payload && event.payload.payment && event.payload.payment.entity;
      const notes = (payment && payment.notes) || {};
      if (notes.userId && PLANS[notes.plan]) {
        db.applyPlanPayment(notes.userId, {
          plan: notes.plan,
          orderId: payment.order_id,
          paymentId: payment.id,
          amount: payment.amount,
          source: 'webhook'
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
}

module.exports = { router, webhookHandler, PLANS };