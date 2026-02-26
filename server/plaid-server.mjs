import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const PORT = Number(process.env.PORT || 8787);
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || undefined;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error('Missing PLAID_CLIENT_ID or PLAID_SECRET in environment.');
  process.exit(1);
}

const envMap = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
};

const configuration = new Configuration({
  basePath: envMap[PLAID_ENV] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: CORS_ORIGINS }));

// Demo in-memory token store. Replace with encrypted DB for production.
const accessTokenByItem = new Map();

const fail = (res, e, fallback = 'Plaid request failed') => {
  const status = e?.response?.status || 500;
  const msg = e?.response?.data?.error_message || e?.message || fallback;
  res.status(status).json({ error: msg });
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: PLAID_ENV, linkedItems: accessTokenByItem.size });
});

app.post('/api/plaid/link-token', async (req, res) => {
  try {
    const userId = String(req.body?.userId || `fortify-${Date.now()}`);
    const payload = {
      user: { client_user_id: userId },
      client_name: 'FortifyOS',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };
    if (PLAID_REDIRECT_URI) payload.redirect_uri = PLAID_REDIRECT_URI;
    const response = await plaidClient.linkTokenCreate(payload);
    res.json({ link_token: response.data.link_token, expiration: response.data.expiration });
  } catch (e) {
    fail(res, e, 'Unable to create Plaid link token');
  }
});

app.post('/api/plaid/exchange-public-token', async (req, res) => {
  try {
    const publicToken = req.body?.publicToken;
    if (!publicToken) return res.status(400).json({ error: 'publicToken is required' });

    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const itemId = exchange.data.item_id;
    const accessToken = exchange.data.access_token;
    accessTokenByItem.set(itemId, accessToken);

    res.json({ ok: true, itemId, linkedItems: accessTokenByItem.size });
  } catch (e) {
    fail(res, e, 'Unable to exchange Plaid public token');
  }
});

app.get('/api/plaid/accounts', async (_req, res) => {
  try {
    const all = [];
    for (const [itemId, accessToken] of accessTokenByItem.entries()) {
      const rsp = await plaidClient.accountsGet({ access_token: accessToken });
      const withItem = (rsp.data.accounts || []).map(a => ({ ...a, item_id: itemId }));
      all.push(...withItem);
    }
    res.json({ accounts: all });
  } catch (e) {
    fail(res, e, 'Unable to fetch Plaid accounts');
  }
});

app.post('/api/plaid/transactions', async (req, res) => {
  try {
    const now = new Date();
    const startDefault = new Date(now);
    startDefault.setDate(startDefault.getDate() - 90);
    const startDate = req.body?.startDate || startDefault.toISOString().slice(0, 10);
    const endDate = req.body?.endDate || now.toISOString().slice(0, 10);
    const count = Math.max(1, Math.min(500, Number(req.body?.count) || 200));

    const allTransactions = [];
    for (const [, accessToken] of accessTokenByItem.entries()) {
      let offset = 0;
      while (true) {
        const rsp = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count, offset },
        });
        const txns = rsp.data.transactions || [];
        allTransactions.push(...txns);
        offset += txns.length;
        if (offset >= (rsp.data.total_transactions || 0) || txns.length === 0) break;
      }
    }

    res.json({ transactions: allTransactions, startDate, endDate });
  } catch (e) {
    fail(res, e, 'Unable to fetch Plaid transactions');
  }
});

app.delete('/api/plaid/items/:itemId', (req, res) => {
  accessTokenByItem.delete(req.params.itemId);
  res.json({ ok: true, linkedItems: accessTokenByItem.size });
});

app.listen(PORT, () => {
  console.log(`Plaid bridge listening on http://localhost:${PORT}`);
});
