# Stripe Setup Instructions

## 1. Environment Variables

Add to `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_xxx          # From Stripe Dashboard > Developers > API keys
STRIPE_WEBHOOK_SECRET=whsec_xxx        # From Webhook endpoint (see step 4)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # Optional, for client-side
```

## 2. Create Products and Prices in Stripe

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Create products for each paid plan:

| Product Name | Price | Billing |
|--------------|-------|---------|
| TravelCMS Starter | €29 | Monthly recurring |
| TravelCMS Pro | €99 | Monthly recurring |
| TravelCMS Enterprise | €299 | Monthly recurring |

3. After creating each Price, copy the **Price ID** (starts with `price_`)

## 3. Update Database with Price IDs

Run in Supabase SQL Editor:

```sql
UPDATE subscription_plans SET stripe_monthly_price_id = 'price_YOUR_STARTER_ID' WHERE name = 'Starter';
UPDATE subscription_plans SET stripe_monthly_price_id = 'price_YOUR_PRO_ID' WHERE name = 'Pro';
UPDATE subscription_plans SET stripe_monthly_price_id = 'price_YOUR_ENTERPRISE_ID' WHERE name = 'Enterprise';
```

## 4. Create Webhook Endpoint

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid` (optional)
   - `invoice.payment_failed` (optional)
5. Copy the **Signing secret** (starts with `whsec_`) to `STRIPE_WEBHOOK_SECRET`

## 5. Local Development

Use Stripe CLI to forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will output a webhook signing secret - use it for `STRIPE_WEBHOOK_SECRET` when testing locally.
