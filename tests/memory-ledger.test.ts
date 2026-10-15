import test from 'node:test';
import assert from 'node:assert/strict';
import { CogneeMemoryLedger } from '../src/memory-ledger.ts';
import { DEFAULT_BILLING_POLICY, PolicyEngine } from '../src/policy.ts';
import type { InvoiceProposal, RealWorldTrigger } from '../src/types.ts';

test('CogneeMemoryLedger stores customer contract graphs, records pound-by-pound audit trails, and answers "why did you bill this?"', async () => {
  const ledger = new CogneeMemoryLedger();

  // Seed customer contract & collections memory in Cognee graph
  const customerProfile = ledger.getCustomerMemory('cust_acme');
  assert.ok(customerProfile);
  assert.equal(customerProfile.customerName, 'Acme Robotics Ltd');
  assert.equal(customerProfile.contractedRatesMinor.API_CALLS_OVERAGE, 4);

  const trigger: RealWorldTrigger = {
    triggerId: 'trig_acme_oct_01',
    type: 'usage_logs',
    receivedAt: '2026-10-15T18:10:00Z',
    customerId: 'cust_acme',
    rawPayload: 'USAGE_WINDOW=2026-10; API_CALLS=145000; INCLUDED_TIER=100000; BILLABLE_OVERAGE=45000',
  };

  const proposal: InvoiceProposal = {
    triggerId: trigger.triggerId,
    customerId: 'cust_acme',
    customerName: customerProfile.customerName,
    customerEmail: customerProfile.customerEmail,
    currency: 'gbp',
    daysUntilDue: 14,
    discountPercent: 0,
    contractReference: customerProfile.contractReference,
    lineItems: [
      {
        sku: 'PLATFORM_BASE',
        description: 'Enterprise Platform Base Retainer (Oct 2026)',
        quantity: 1,
        unitAmountMinor: 250000,
        totalAmountMinor: 250000,
        clauseCitation: 'MSA-2026-ACME-04 §3.1 — Monthly Base Fee £2,500.00',
        sourceEvidence: 'contract:MSA-2026-ACME-04#sec-3.1',
      },
      {
        sku: 'API_CALLS_OVERAGE',
        description: 'Metered API Calls Overage (45,000 calls @ £0.04)',
        quantity: 45000,
        unitAmountMinor: 4,
        totalAmountMinor: 180000,
        clauseCitation: 'MSA-2026-ACME-04 §4.2 — £0.04/call above 100,000 monthly allowance',
        sourceEvidence: trigger.rawPayload,
      },
    ],
  };

  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const decision = engine.evaluate(proposal, {
    contractedRatesMinor: customerProfile.contractedRatesMinor,
    previouslyBilledTriggerIds: ledger.getBilledTriggerIds(),
  });

  const entry = await ledger.recordAuditEntry({
    trigger,
    proposal,
    policyDecision: decision,
    stripeArtifact: {
      mode: 'simulated_stripe_test_mode',
      stripeCustomerId: 'cus_test_acme',
      stripeInvoiceId: 'in_test_acme_001',
      stripeInvoiceItemIds: ['ii_test_1', 'ii_test_2'],
      status: 'open',
      amountDueMinor: 430000,
      currency: 'gbp',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/acct_test/test_acme_001',
      invoicePdfUrl: 'https://pay.stripe.com/invoice/acct_test/test_acme_001/pdf',
    },
  });

  assert.ok(entry.entryId.startsWith('audit_'));
  assert.ok(entry.cogneeMemoryNodeIds.length >= 2);
  assert.match(entry.poundByPoundExplanation, /£4,300\.00/);
  assert.match(entry.poundByPoundExplanation, /MSA-2026-ACME-04 §3\.1/);
  assert.match(entry.poundByPoundExplanation, /MSA-2026-ACME-04 §4\.2/);

  // Verify "Explain Every Pound" query from Cognee memory
  const answer = ledger.explainInvoice(entry.entryId, 'Why did you bill £1,800 for API overage?');
  assert.match(answer.explanation, /45,000/);
  assert.match(answer.explanation, /£0\.04/);
  assert.match(answer.explanation, /MSA-2026-ACME-04 §4\.2/);
  assert.equal(answer.memoryNodesConsulted.length, entry.cogneeMemoryNodeIds.length);
});
