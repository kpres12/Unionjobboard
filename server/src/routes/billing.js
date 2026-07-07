import { Router } from 'express';
import express from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { LISTING_PLANS } from '../constants/listingPlans.js';
import { communityQuotaUsed } from '../services/listingBilling.js';
import {
  devAutoPayEnabled,
  handleStripeWebhook,
  stripeEnabled,
  verifyCheckoutSession,
} from '../services/stripe.js';

const router = Router();

router.get('/plans', (_req, res) => {
  res.json({
    plans: Object.values(LISTING_PLANS),
    stripeEnabled: stripeEnabled() || devAutoPayEnabled(),
  });
});

router.get('/status', (_req, res) => {
  res.json({
    stripeConfigured: stripeEnabled(),
    devAutoPay: devAutoPayEnabled(),
    appUrl: process.env.APP_URL || 'http://localhost:5173',
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
});

router.get('/quota', authRequired, (req, res) => {
  const plan = LISTING_PLANS.community;
  const used = communityQuotaUsed(req.user.id);

  res.json({
    quota: {
      limit: plan.quotaLimit,
      used,
      remaining: Math.max(plan.quotaLimit - used, 0),
      windowDays: plan.quotaDays,
    },
  });
});

router.post('/confirm', authRequired, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const jobId = await verifyCheckoutSession(sessionId, req.user.id);
    if (!jobId) {
      return res.status(404).json({ error: 'Checkout session not found' });
    }

    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    res.json({ jobId, paymentStatus: row.payment_status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export async function billingWebhookHandler(req, res) {
  try {
    const signature = req.headers['stripe-signature'];
    const eventType = await handleStripeWebhook(req.body, signature);
    res.json({ received: true, type: eventType });
  } catch (error) {
    console.error('Stripe webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
}

export default router;
