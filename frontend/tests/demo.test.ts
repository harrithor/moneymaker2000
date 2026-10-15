import test from 'node:test';
import assert from 'node:assert/strict';
import { runGuidedDemo } from '../src/demo.ts';

test('runGuidedDemo executes all 4 hackathon showcase acts and verifies all 4 judging pillars', async () => {
  const report = await runGuidedDemo();

  assert.equal(report.acts.length, 4);

  // Act 1: Telemetry usage logs -> £4,930.00 auto_finalize_and_send
  assert.equal(report.acts[0].entry.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(report.acts[0].entry.policyDecision.netTotalMinor, 493000);
  assert.equal(report.acts[0].entry.stripeArtifact?.status, 'open');

  // Act 2: Cognee dispute memory -> 10% goodwill discount -> £3,510.00 auto_finalize_and_send
  assert.equal(report.acts[1].entry.proposal.discountPercent, 10);
  assert.equal(report.acts[1].entry.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(report.acts[1].entry.policyDecision.netTotalMinor, 351000);

  // Act 3: £12,500 SOW rollout -> exceeds £10k cap (POL-LIMIT-001) -> hold_draft_for_approval
  assert.equal(report.acts[2].entry.policyDecision.action, 'hold_draft_for_approval');
  assert.equal(report.acts[2].entry.policyDecision.netTotalMinor, 1250000);
  assert.equal(report.acts[2].entry.stripeArtifact?.status, 'draft');

  // Act 4: Rogue 25% discount email -> blocked by POL-DISC-002 -> reject_policy_violation
  assert.equal(report.acts[3].entry.policyDecision.approved, false);
  assert.equal(report.acts[3].entry.policyDecision.action, 'reject_policy_violation');
  assert.equal(report.acts[3].entry.stripeArtifact, undefined);
});
