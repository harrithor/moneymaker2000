import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadLumenPolicyMarkdown,
  buildLumenFaqFromPolicy,
  parseBackendServerLogEvents
} from '../src/lumen-bridge.ts';
import { createAppController } from '../src/app.ts';

test('loadLumenPolicyMarkdown reads backend/email-machinery/app/policy.md and generates accurate FAQ entries', () => {
  const policyMd = loadLumenPolicyMarkdown();
  assert.ok(policyMd.includes('# Lumen & Lode — custom jewellery pricing and policy'));
  assert.ok(policyMd.includes('## Metals (price per gram of finished piece)'));
  assert.ok(policyMd.includes('## What we don\'t make'));

  const faq = buildLumenFaqFromPolicy(policyMd);
  assert.ok(faq.length >= 5);
  assert.ok(faq.some((entry) => entry.question.toLowerCase().includes('£0')));
  assert.ok(faq.some((entry) => entry.answer.toLowerCase().includes('30 days')));
  assert.ok(faq.some((entry) => entry.answer.toLowerCase().includes('weapons')));
});

test('parseBackendServerLogEvents extracts real Resend + Gemini clarify emails from backend/email-machinery/server.log', () => {
  const logEvents = parseBackendServerLogEvents();
  assert.equal(logEvents.length, 2);

  assert.equal(logEvents[0].customerEmail, 'matthewcarter2301@gmail.com');
  assert.equal(logEvents[0].decision, 'clarify');
  assert.ok(logEvents[0].reasoning.includes('east-west marquise stone pendant'));
  assert.equal(logEvents[0].resendReplyId, '01a140f2-cd5a-781b-99f0-0f4b3e98ae6e');

  assert.equal(logEvents[1].customerEmail, 'matthewcarter2301@gmail.com');
  assert.equal(logEvents[1].decision, 'clarify');
  assert.ok(logEvents[1].reasoning.includes('G–H/VS (£4,000/ct)'));
  assert.equal(logEvents[1].resendReplyId, '01a140f5-5a7d-7db4-9a43-655ee9347d66');
});

test('Unified AppController processes Lumen & Lode bespoke jewellery triggers with policy.md component pricing and Resend reply drafts', async () => {
  const controller = createAppController();
  const state = controller.getState();

  assert.ok(state.lumenPolicyMarkdown.includes('Lumen & Lode'));
  assert.equal(state.backendLiveEvents.length, 2);
  assert.ok(state.faq.length >= 5);

  // Act 1: Matthew Carter confirms specs for his east-west marquise pendant from server.log
  const matthewEntry = await controller.runDemoTrigger('trig_lumen_matthew_pendant');
  assert.equal(matthewEntry.policyDecision.action, 'auto_finalize_and_send');
  assert.equal(matthewEntry.lumenDraft?.decision, 'invoice');
  // 9ct gold pendant (3g @ £45 = £135) + 0.5ct Natural Diamond G-H VS (£2,000) + 9ct gold chain (£220) + CAD (£150) + Pendant making (3h @ £60 = £180) + Main stone setting (£40) = £2,725.00 (272500 pence)
  assert.equal(matthewEntry.policyDecision.netTotalMinor, 2725_00);
  assert.equal(matthewEntry.stripeArtifact?.status, 'open');
  assert.ok(matthewEntry.lumenDraft?.message_to_customer.includes('Thank you'));

  // Act 4: Prohibited weapon charm request is declined per policy.md "What we don't make"
  const declineEntry = await controller.runDemoTrigger('trig_lumen_weapon_decline');
  assert.equal(declineEntry.policyDecision.action, 'reject_policy_violation');
  assert.equal(declineEntry.lumenDraft?.decision, 'decline');
  assert.equal(declineEntry.stripeArtifact, undefined);
});
