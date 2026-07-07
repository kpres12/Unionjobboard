import { Router } from 'express';
import express from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { LISTING_PLANS } from '../constants/listingPlans.js';
import { communityQuotaUsed } from '../services/listingBilling.js';
import {
  createCustomerPortalSession,
  createSubscriptionCheckout,
  devAutoPayEnabled,
  handleStripeWebhook,
  getSubscriptionPriceConfig,
  stripeEnabled,
  verifyCheckoutSession,
} from '../services/stripe.js';

const router = Router();

router.get('/plans', (_req, res) => {
  res.json({
    plans: Object.values(LISTING_PLANS),
    stripeEnabled: stripeEnabled() || devAutoPayEnabled(),
    subscriptionPlans: [
      { id: 'starter', name: 'Starter', priceLabel: '$399/mo' },
      { id: 'growth', name: 'Growth', priceLabel: '$999/mo' },
      { id: 'enterprise', name: 'Enterprise', priceLabel: 'Contact sales' },
    ],
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

router.get('/subscription', authRequired, (req, res) => {
  const row = db
    .prepare(
      `SELECT subscription_status, subscription_plan_id, subscription_current_period_end,
              subscription_cancel_at_period_end
       FROM users WHERE id = ?`
    )
    .get(req.user.id);

  const prices = getSubscriptionPriceConfig();
  const configuredPlans = Object.entries(prices)
    .filter(([, price]) => Boolean(price))
    .map(([id, priceId]) => ({ id, priceId }));

  res.json({
    subscription: {
      status: row?.subscription_status || 'inactive',
      planId: row?.subscription_plan_id || null,
      currentPeriodEnd: row?.subscription_current_period_end || null,
      cancelAtPeriodEnd: Boolean(row?.subscription_cancel_at_period_end),
      hasActiveSubscription: ['trialing', 'active', 'past_due'].includes(
        row?.subscription_status || 'inactive'
      ),
    },
    configuredPlans,
  });
});

router.post('/subscription/checkout', authRequired, async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }
  try {
    const user = db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
    const checkoutUrl = await createSubscriptionCheckout(user, planId);
    res.json({ checkoutUrl });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not create subscription checkout' });
  }
});

router.post('/subscription/portal', authRequired, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
    const portalUrl = await createCustomerPortalSession(user);
    res.json({ portalUrl });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not open billing portal' });
  }
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
