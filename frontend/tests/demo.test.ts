import test from 'node:test';
import assert from 'node:assert/strict';
import { runGuidedDemo } from '../src/demo.ts';

test('runGuidedDemo executes all 4 unified Lumen & Lode + Cognee + Stripe showcase acts and verifies all 4 judging pillars', async () => {
  const report = await runGuidedDemo();

  assert.equal(report.backendLiveEvents.length, 2);
  assert.equal(report.backendLiveEvents[0].decision, 'clarify');
  assert.equal(report.acts.length, 4);

  // Act 1: Matthew's East-West Marquise Pendant (continuing server.log thread) -> £2,725.00 auto_finalize_and_send
  assert.equal(report.acts[0].entry.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(report.acts[0].entry.policyDecision.netTotalMinor, 2725_00);
  assert.equal(report.acts[0].entry.stripeArtifact?.status, 'open');
  assert.equal(report.acts[0].entry.lumenDraft?.decision, 'invoice');

  // Act 2: Lady Eleanor Vance Sapphire Halo Ring + Cognee 10% goodwill discount -> £2,088.00 auto_finalize_and_send
  assert.equal(report.acts[1].entry.proposal.discountPercent, 10);
  assert.equal(report.acts[1].entry.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(report.acts[1].entry.policyDecision.netTotalMinor, 2088_00);
  assert.equal(report.acts[1].entry.stripeArtifact?.status, 'open');

  // Act 3: £11,995.00 Platinum 1.50ct D-F VVS Diamond Solitaire -> exceeds £10k cap (POL-LIMIT-001) -> hold_draft_for_approval
  assert.equal(report.acts[2].entry.policyDecision.action, 'hold_draft_for_approval');
  assert.equal(report.acts[2].entry.policyDecision.netTotalMinor, 11995_00);
  assert.equal(report.acts[2].entry.stripeArtifact?.status, 'draft');

  // Act 4: Prohibited AK-47 weapon charm + 95% prompt injection -> blocked by policy.md & POL-DISC-002 -> reject_policy_violation
  assert.equal(report.acts[3].entry.policyDecision.approved, false);
  assert.equal(report.acts[3].entry.policyDecision.action, 'reject_policy_violation');
  assert.equal(report.acts[3].entry.lumenDraft?.decision, 'decline');
  assert.equal(report.acts[3].entry.stripeArtifact, undefined);
});
