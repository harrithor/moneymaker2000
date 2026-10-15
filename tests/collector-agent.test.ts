import test from 'node:test';
import assert from 'node:assert/strict';
import { AutonomousCollectorAgent, DEMO_TRIGGERS } from '../src/collector-agent.ts';
import { CogneeMemoryLedger } from '../src/memory-ledger.ts';
import { PolicyEngine } from '../src/policy.ts';
import { StripeTestClient } from '../src/stripe-client.ts';

test('AutonomousCollectorAgent processes telemetry usage logs into a finalized Stripe Test Mode invoice with full audit trail', async () => {
  const ledger = new CogneeMemoryLedger();
  const policy = new PolicyEngine();
  const stripe = new StripeTestClient({ stripeSecretKey: '' });
  const agent = new AutonomousCollectorAgent({ ledger, policy, stripe });

  const usageTrigger = DEMO_TRIGGERS.find((t) => t.triggerId === 'trig_demo_acme_usage');
  assert.ok(usageTrigger);

  const result = await agent.processTrigger(usageTrigger);

  assert.equal(result.policyDecision.approved, true);
  assert.equal(result.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(result.policyDecision.netTotalMinor, 493000); // £2,500 base + £1,800 API overage + £630 GPU hours = £4,930.00
  assert.ok(result.stripeArtifact);
  assert.equal(result.stripeArtifact.status, 'open');
  assert.match(result.poundByPoundExplanation, /£4,930\.00/);
});

test('AutonomousCollectorAgent holds high-value milestone email as Stripe draft when exceeding £10k policy threshold', async () => {
  const ledger = new CogneeMemoryLedger();
  const policy = new PolicyEngine();
  const stripe = new StripeTestClient({ stripeSecretKey: '' });
  const agent = new AutonomousCollectorAgent({ ledger, policy, stripe });

  const highValueTrigger = DEMO_TRIGGERS.find((t) => t.triggerId === 'trig_demo_northstar_rollout');
  assert.ok(highValueTrigger);

  const result = await agent.processTrigger(highValueTrigger);

  assert.equal(result.policyDecision.approved, true);
  assert.equal(result.policyDecision.action, 'hold_draft_for_approval');
  assert.ok(result.stripeArtifact);
  assert.equal(result.stripeArtifact.status, 'draft');
});

test('AutonomousCollectorAgent recalls historical dispute memory from Cognee to apply agreed 10% goodwill discount', async () => {
  const ledger = new CogneeMemoryLedger();
  const policy = new PolicyEngine();
  const stripe = new StripeTestClient({ stripeSecretKey: '' });
  const agent = new AutonomousCollectorAgent({ ledger, policy, stripe });

  const disputeTrigger = DEMO_TRIGGERS.find((t) => t.triggerId === 'trig_demo_vanguard_renewal');
  assert.ok(disputeTrigger);

  const result = await agent.processTrigger(disputeTrigger);

  assert.equal(result.proposal.discountPercent, 10);
  assert.equal(result.policyDecision.approved, true);
  assert.equal(result.policyDecision.action, 'auto_finalize_and_send');
  // 20 seats * £150 (£3,000) + £900 compliance addon = £3,900 gross - 10% (£390) = £3,510.00 (351000p)
  assert.equal(result.policyDecision.netTotalMinor, 351000);
});
