import Stripe from 'stripe';
import db from '../db.js';
import { getListingPlan } from '../constants/listingPlans.js';
import { activateListing } from './listingBilling.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const ACTIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];

const SUBSCRIPTION_PRICE_KEYS = {
  starter: 'STRIPE_SUBSCRIPTION_PRICE_STARTER',
  growth: 'STRIPE_SUBSCRIPTION_PRICE_GROWTH',
  enterprise: 'STRIPE_SUBSCRIPTION_PRICE_ENTERPRISE',
};

export function stripeEnabled() {
  return Boolean(stripe);
}

export function devAutoPayEnabled() {
  return process.env.STRIPE_DEV_AUTO_PAY === 'true';
}

export async function createListingCheckout(job, plan, userEmail) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: plan.priceCents,
          product_data: {
            name: `Haymarket ${plan.name} listing`,
            description: plan.details,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      jobId: String(job.id),
      listingTier: plan.id,
    },
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing/cancel?job_id=${job.id}`,
  });

  db.prepare('UPDATE jobs SET stripe_checkout_session_id = ? WHERE id = ?').run(session.id, job.id);

  return session.url;
}

export function markListingPaid(jobId, listingTier) {
  const plan = getListingPlan(listingTier);
  if (!plan) return;

  activateListing(jobId, plan, 'paid');
}

function toIsoFromUnix(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function updateUserSubscriptionByCustomerId(customerId, subscription) {
  if (!customerId) return;
  const status = subscription?.status || 'inactive';
  db.prepare(
    `UPDATE users
     SET subscription_status = ?,
         subscription_plan_id = ?,
         subscription_current_period_end = ?,
         subscription_cancel_at_period_end = ?
     WHERE stripe_customer_id = ?`
  ).run(
    status,
    subscription?.items?.data?.[0]?.price?.id || null,
    toIsoFromUnix(subscription?.current_period_end),
    subscription?.cancel_at_period_end ? 1 : 0,
    customerId
  );
}

export function hasActiveSubscription(userId) {
  const row = db
    .prepare('SELECT subscription_status FROM users WHERE id = ?')
    .get(userId);
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(row?.subscription_status || 'inactive');
}

export function getSubscriptionPriceConfig() {
  return Object.fromEntries(
    Object.entries(SUBSCRIPTION_PRICE_KEYS).map(([planId, envKey]) => [
      planId,
      process.env[envKey] || null,
    ])
  );
}

async function getOrCreateStripeCustomer(user) {
  if (!stripe) throw new Error('Stripe is not configured');
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user.id) },
  });

  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, user.id);
  return customer.id;
}

export async function createSubscriptionCheckout(user, planId) {
  if (!stripe) throw new Error('Stripe is not configured');
  const prices = getSubscriptionPriceConfig();
  const priceId = prices[planId];
  if (!priceId) throw new Error(`Subscription plan is not configured: ${planId}`);

  const customerId = await getOrCreateStripeCustomer(user);
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      userId: String(user.id),
      subscriptionPlan: planId,
    },
    success_url: `${appUrl}/account?billing=success`,
    cancel_url: `${appUrl}/account?billing=cancel`,
    allow_promotion_codes: true,
  });

  return session.url;
}

export async function createCustomerPortalSession(user) {
  if (!stripe) throw new Error('Stripe is not configured');
  const customerId = await getOrCreateStripeCustomer(user);
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/account`,
  });
  return session.url;
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const jobId = Number(session.metadata?.jobId);
    const listingTier = session.metadata?.listingTier;

    if (jobId && listingTier) {
      markListingPaid(jobId, listingTier);
    }

    if (session.mode === 'subscription' && session.customer) {
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        updateUserSubscriptionByCustomerId(session.customer, subscription);
      }
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    updateUserSubscriptionByCustomerId(customerId, subscription);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    updateUserSubscriptionByCustomerId(customerId, {
      status: 'inactive',
      items: { data: [] },
      current_period_end: null,
      cancel_at_period_end: false,
    });
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      db.prepare(
        `UPDATE users
         SET subscription_status = 'past_due'
         WHERE stripe_customer_id = ?`
      ).run(customerId);
    }
  }

  return event.type;
}

export async function verifyCheckoutSession(sessionId, userId) {
  if (!stripe) {
    return null;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const jobId = Number(session.metadata?.jobId);

  if (!jobId) {
    return null;
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job || job.posted_by !== userId) {
    return null;
  }

  if (session.payment_status === 'paid' && job.payment_status !== 'paid') {
    markListingPaid(jobId, session.metadata.listingTier);
  }

  return jobId;
}
