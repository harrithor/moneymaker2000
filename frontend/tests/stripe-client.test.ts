import test from 'node:test';
import assert from 'node:assert/strict';
import { StripeTestClient } from '../src/stripe-client.ts';
import type { InvoiceProposal } from '../src/types.ts';

const sampleProposal: InvoiceProposal = {
  triggerId: 'trig_stripe_001',
  customerId: 'cust_acme',
  customerName: 'Acme Robotics Ltd',
  customerEmail: 'ap@acmerobotics.co.uk',
  currency: 'gbp',
  daysUntilDue: 14,
  discountPercent: 10,
  contractReference: 'MSA-2026-ACME-04',
  lineItems: [
    {
      sku: 'PLATFORM_BASE',
      description: 'Enterprise Platform Base Retainer',
      quantity: 1,
      unitAmountMinor: 250000,
      totalAmountMinor: 250000,
      clauseCitation: 'MSA-2026-ACME-04 §3.1',
      sourceEvidence: 'contract:MSA-2026-ACME-04#sec-3.1',
    },
  ],
};

test('StripeTestClient rejects live Stripe keys (sk_live_*) to enforce hackathon Rule 3', () => {
  assert.throws(
    () => new StripeTestClient({ stripeSecretKey: 'sk_live_123456789' }),
    /Stripe test mode only/i
  );
});

test('StripeTestClient executes real REST flow against injected fetch (Customers -> Invoice -> InvoiceItems -> Finalize)', async () => {
  const calls: Array<{ url: string; body: string }> = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    calls.push({ url, body });

    if (url.endsWith('/v1/customers')) {
      return new Response(JSON.stringify({ id: 'cus_test_999' }), { status: 200 });
    }
    if (url.endsWith('/v1/invoices')) {
      return new Response(
        JSON.stringify({
          id: 'in_test_888',
          status: 'draft',
          amount_due: 225000,
          hosted_invoice_url: 'https://invoice.stripe.com/i/acct_test/draft_888',
          invoice_pdf: 'https://pay.stripe.com/invoice/acct_test/draft_888/pdf',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/v1/invoiceitems')) {
      return new Response(JSON.stringify({ id: `ii_test_${calls.length}` }), { status: 200 });
    }
    if (url.endsWith('/v1/invoices/in_test_888/finalize')) {
      return new Response(
        JSON.stringify({
          id: 'in_test_888',
          status: 'open',
          amount_due: 225000,
          hosted_invoice_url: 'https://invoice.stripe.com/i/acct_test/live_888',
          invoice_pdf: 'https://pay.stripe.com/invoice/acct_test/live_888/pdf',
        }),
        { status: 200 }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new StripeTestClient({
    stripeSecretKey: 'sk_test_hackathon_mock_key',
    fetchImpl: fakeFetch,
  });

  const artifact = await client.createAndIssueInvoice(sampleProposal, 'auto_finalize_and_send');

  assert.equal(artifact.mode, 'live_stripe_test_api');
  assert.equal(artifact.stripeCustomerId, 'cus_test_999');
  assert.equal(artifact.stripeInvoiceId, 'in_test_888');
  assert.equal(artifact.status, 'open');
  assert.equal(artifact.amountDueMinor, 225000);
  assert.ok(calls.some((c) => c.url.endsWith('/v1/invoices/in_test_888/finalize')));
});

test('StripeTestClient leaves invoice in draft status when policy action is hold_draft_for_approval', async () => {
  const client = new StripeTestClient({ stripeSecretKey: '' }); // deterministic test-mode simulator when no key set
  const artifact = await client.createAndIssueInvoice(sampleProposal, 'hold_draft_for_approval');

  assert.equal(artifact.mode, 'simulated_stripe_test_mode');
  assert.equal(artifact.status, 'draft');
  assert.equal(artifact.amountDueMinor, 225000);
});
