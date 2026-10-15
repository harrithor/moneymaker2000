import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/app.ts';

test('AppController exposes state, processes demo triggers, explains invoices, and configures Stripe test keys', async () => {
  const app = createAppController();

  // 1. Initial state includes customers, policy, and demo triggers
  const initialState = app.getState();
  assert.equal(initialState.customers.length, 6);
  assert.equal(initialState.demoTriggers.length, 8);
  assert.equal(initialState.auditEntries.length, 0);

  // 2. Trigger autonomous invoice creation from demo trigger
  const entry = await app.runDemoTrigger('trig_demo_acme_usage');
  assert.equal(entry.policyDecision.approved, true);
  assert.equal(entry.policyDecision.netTotalMinor, 493000);

  // 3. Ask "Explain Every Pound"
  const explanation = app.explainEntry(
    entry.entryId,
    'Why was Acme billed £4,930?'
  );
  assert.match(explanation.explanation, /MSA-2026-ACME-04/);
  assert.equal(explanation.memoryNodesConsulted.length, 3);

  // 4. Reject live Stripe keys
  assert.throws(
    () => app.configureStripeKey('sk_live_forbidden'),
    /Stripe test mode only/i
  );
});
