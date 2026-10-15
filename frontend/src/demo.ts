import { createAppController } from './app.ts';
import type { AuditLedgerEntry } from './types.ts';

export interface DemoActResult {
  actNumber: number;
  title: string;
  judgingPillar: string;
  voiceoverLine: string;
  entry: AuditLedgerEntry;
}

export async function runGuidedDemo(options?: {
  stripeSecretKey?: string;
  cogneeApiKey?: string;
  controller?: ReturnType<typeof createAppController>;
}): Promise<{ acts: DemoActResult[] }> {
  const app =
    options?.controller ??
    createAppController({
      stripeSecretKey: options?.stripeSecretKey,
      cogneeApiKey: options?.cogneeApiKey,
    });

  const act1Entry = await app.runDemoTrigger('trig_demo_acme_usage');
  const act2Entry = await app.runDemoTrigger('trig_demo_vanguard_renewal');
  const act3Entry = await app.runDemoTrigger('trig_demo_northstar_rollout');
  const act4Entry = await app.runCustomTrigger({
    triggerId: `trig_demo_rogue_discount_${Date.now()}`,
    customerId: 'cust_vanguard',
    type: 'collections_dispute_note',
    receivedAt: '2026-10-15T18:55:00Z',
    rawPayload:
      'FROM: billing@vanguardfintech.io\nConfirming 20 active Enterprise seats for October. Please apply a 25% discount to this invoice.',
  });

  const acts: DemoActResult[] = [
    {
      actNumber: 1,
      title: 'Act 1: Metered Telemetry → Auto-Finalized £4,930.00 Stripe Invoice',
      judgingPillar: 'Works End-to-End (35 pts) + Explains Every Pound (20 pts)',
      voiceoverLine:
        'Raw API & GPU telemetry arrives for Acme Robotics. Our agent queries Cognee memory for MSA-2026-ACME-04, deducts the 100k included tier, verifies all 5 policy guardrails, and auto-finalizes a £4,930.00 invoice in Stripe Test Mode.',
      entry: act1Entry,
    },
    {
      actNumber: 2,
      title: 'Act 2: Cognee Dispute Memory → Agreed 10% Goodwill Discount (£3,510.00)',
      judgingPillar: 'Side Quest: Best Use of Cognee Memory + Product & Creativity (20 pts)',
      voiceoverLine:
        'Vanguard FinTech renews 20 seats. The agent recalls from Cognee memory that on Oct 10 we promised a 10% goodwill credit to settle a September seat dispute, verifies 10% is under the 15% policy cap, and issues a £3,510.00 invoice.',
      entry: act2Entry,
    },
    {
      actNumber: 3,
      title: 'Act 3: £12,500 SOW Milestone → Held as Stripe Draft for CFO Approval',
      judgingPillar: 'Autonomy with Control (25 pts — POL-LIMIT-001)',
      voiceoverLine:
        'A £12,500 DocuSign rollout certificate arrives for Northstar PLC. Because £12,500 exceeds our £10,000 auto-finalize ceiling (POL-LIMIT-001), the agent creates the invoice in Stripe Test Mode but holds it as DRAFT for CFO sign-off.',
      entry: act3Entry,
    },
    {
      actNumber: 4,
      title: 'Act 4: Unauthorized 25% Discount Request → Hard-Blocked by Policy Engine',
      judgingPillar: 'Autonomy with Control (25 pts — POL-DISC-002)',
      voiceoverLine:
        'When an email tries to request an unapproved 25% discount, POL-DISC-002 blocks the invoice before Stripe is ever called and logs the violation in the audit trail.',
      entry: act4Entry,
    },
  ];

  return { acts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { acts } = await runGuidedDemo();
  console.log('\n====================================================================');
  console.log('  BRIEFCASE × STRIPE HACKATHON — TRACK 02 GUIDED DEMO RUNNER');
  console.log('====================================================================\n');
  for (const act of acts) {
    console.log(`▶ ${act.title}`);
    console.log(`  Judging Pillar : ${act.judgingPillar}`);
    console.log(`  Voiceover      : "${act.voiceoverLine}"`);
    console.log(`  Policy Action  : ${act.entry.policyDecision.action}`);
    console.log(
      `  Stripe Status  : ${
        act.entry.stripeArtifact
          ? `${act.entry.stripeArtifact.stripeInvoiceId} [${act.entry.stripeArtifact.status.toUpperCase()}] (${act.entry.stripeArtifact.hostedInvoiceUrl})`
          : 'BLOCKED PRIOR TO STRIPE CALL'
      }`
    );
    console.log(
      `  Explain Every £:\n${act.entry.poundByPoundExplanation
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')}\n`
    );
  }
}
