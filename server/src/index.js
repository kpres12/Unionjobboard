import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import billingRoutes, { billingWebhookHandler } from './routes/billing.js';
import intelligenceRoutes from './routes/intelligence.js';
import organizationRoutes from './routes/organizations.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'node-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/organizations', organizationRoutes);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
