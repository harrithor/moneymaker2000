import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine, DEFAULT_BILLING_POLICY } from '../src/policy.ts';
import type { InvoiceProposal } from '../src/types.ts';

const baseProposal: InvoiceProposal = {
  triggerId: 'trig_001',
  customerId: 'cust_acme',
  customerName: 'Acme Robotics Ltd',
  customerEmail: 'ap@acmerobotics.co.uk',
  currency: 'gbp',
  daysUntilDue: 14,
  discountPercent: 0,
  contractReference: 'MSA-2026-ACME-04',
  lineItems: [
    {
      sku: 'API_CALLS_OVERAGE',
      description: 'API Token Overage (45,000 units @ £0.04/unit)',
      quantity: 45000,
      unitAmountMinor: 4,
      totalAmountMinor: 180000,
      clauseCitation: 'Section 4.2 — Metered API Overage at £0.04 per call above 100k included tier',
      sourceEvidence: 'usage_log:2026-10-15T18:00Z total=145,000 included=100,000 billable=45,000',
    },
    {
      sku: 'PLATFORM_BASE',
      description: 'October 2026 Enterprise Platform Retainer',
      quantity: 1,
      unitAmountMinor: 250000,
      totalAmountMinor: 250000,
      clauseCitation: 'Section 3.1 — Monthly Platform Base Fee £2,500.00',
      sourceEvidence: 'contract:MSA-2026-ACME-04#sec-3.1',
    },
  ],
};

test('PolicyEngine approves compliant invoice under auto-finalize limit', () => {
  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const decision = engine.evaluate(baseProposal, {
    contractedRatesMinor: { API_CALLS_OVERAGE: 4, PLATFORM_BASE: 250000 },
    previouslyBilledTriggerIds: new Set(),
  });

  assert.equal(decision.approved, true);
  assert.equal(decision.action, 'auto_finalize_and_send');
  assert.equal(decision.netTotalMinor, 430000);
  assert.ok(decision.checks.every((c) => c.passed));
});

test('PolicyEngine holds invoice as draft when total exceeds maxAutoFinalizeAmountMinor (POL-LIMIT-001)', () => {
  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const highValueProposal: InvoiceProposal = {
    ...baseProposal,
    triggerId: 'trig_high_002',
    lineItems: [
      {
        sku: 'CUSTOM_DEPLOYMENT',
        description: 'Dedicated Cluster Buildout Milestone 1',
        quantity: 1,
        unitAmountMinor: 1250000, // £12,500 > £10,000 cap
        totalAmountMinor: 1250000,
        clauseCitation: 'SOW-2026-09 Clause 2.1 — £12,500 on UAT sign-off',
        sourceEvidence: 'email:cto@acmerobotics.co.uk "UAT signed off"',
      },
    ],
  };

  const decision = engine.evaluate(highValueProposal, {
    contractedRatesMinor: { CUSTOM_DEPLOYMENT: 1250000 },
    previouslyBilledTriggerIds: new Set(),
  });

  assert.equal(decision.approved, true);
  assert.equal(decision.action, 'hold_draft_for_approval');
  const limitCheck = decision.checks.find((c) => c.ruleId === 'POL-LIMIT-001');
  assert.ok(limitCheck);
  assert.equal(limitCheck.passed, false);
});

test('PolicyEngine blocks invoice when discount exceeds maxDiscountPercent (POL-DISC-002)', () => {
  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const excessiveDiscountProposal: InvoiceProposal = {
    ...baseProposal,
    triggerId: 'trig_disc_003',
    discountPercent: 25, // > 15% policy cap
  };

  const decision = engine.evaluate(excessiveDiscountProposal, {
    contractedRatesMinor: { API_CALLS_OVERAGE: 4, PLATFORM_BASE: 250000 },
    previouslyBilledTriggerIds: new Set(),
  });

  assert.equal(decision.approved, false);
  assert.equal(decision.action, 'reject_policy_violation');
  const discCheck = decision.checks.find((c) => c.ruleId === 'POL-DISC-002');
  assert.ok(discCheck);
  assert.equal(discCheck.passed, false);
});

test('PolicyEngine blocks duplicate trigger billing (POL-DUP-003)', () => {
  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const decision = engine.evaluate(baseProposal, {
    contractedRatesMinor: { API_CALLS_OVERAGE: 4, PLATFORM_BASE: 250000 },
    previouslyBilledTriggerIds: new Set(['trig_001']),
  });

  assert.equal(decision.approved, false);
  assert.equal(decision.action, 'reject_policy_violation');
  const dupCheck = decision.checks.find((c) => c.ruleId === 'POL-DUP-003');
  assert.ok(dupCheck);
  assert.equal(dupCheck.passed, false);
});

test('PolicyEngine blocks invoice when line item unit price mismatches contracted rate card (POL-RATE-004)', () => {
  const engine = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const decision = engine.evaluate(baseProposal, {
    contractedRatesMinor: { API_CALLS_OVERAGE: 2, PLATFORM_BASE: 250000 }, // Contract says 2p, proposal says 4p
    previouslyBilledTriggerIds: new Set(),
  });

  assert.equal(decision.approved, false);
  assert.equal(decision.action, 'reject_policy_violation');
  const rateCheck = decision.checks.find((c) => c.ruleId === 'POL-RATE-004');
  assert.ok(rateCheck);
  assert.equal(rateCheck.passed, false);
});
