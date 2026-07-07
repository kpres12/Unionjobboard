import Stripe from 'stripe';
import db from '../db.js';
import { getListingPlan } from '../constants/listingPlans.js';
import { activateListing } from './listingBilling.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

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
