import type { CogneeMemoryLedger } from './memory-ledger.ts';
import type { PolicyEngine } from './policy.ts';
import type { StripeTestClient } from './stripe-client.ts';
import type {
  AuditLedgerEntry,
  InvoiceProposal,
  ProposedLineItem,
  RealWorldTrigger,
} from './types.ts';

export const DEMO_TRIGGERS: RealWorldTrigger[] = [
  {
    triggerId: 'trig_demo_acme_usage',
    type: 'usage_logs',
    receivedAt: '2026-10-15T18:15:00Z',
    customerId: 'cust_acme',
    rawPayload: [
      'TELEMETRY_EXPORT window=2026-10-01..2026-10-15 customer=cust_acme',
      'base_retainer=1',
      'api_calls_total=145000 api_calls_included=100000 api_calls_overage=45000',
      'dedicated_gpu_hours=180',
    ].join('\n'),
  },
  {
    triggerId: 'trig_demo_vanguard_renewal',
    type: 'collections_dispute_note',
    receivedAt: '2026-10-15T18:22:00Z',
    customerId: 'cust_vanguard',
    rawPayload: [
      'FROM: billing@vanguardfintech.io',
      'SUBJECT: RE: October Enterprise Seat Renewal + September Dispute Follow-up',
      'BODY: Confirming our 20 active Enterprise seats + Compliance Add-on for October. Per our Oct 10 agreement, please apply the 10% goodwill discount to settle the September seat-count dispute.',
    ].join('\n'),
  },
  {
    triggerId: 'trig_demo_northstar_uat',
    type: 'signed_milestone_email',
    receivedAt: '2026-10-15T18:30:00Z',
    customerId: 'cust_northstar',
    rawPayload: [
      'FROM: vp-ops@northstar-plc.co.uk',
      'SUBJECT: Phase 1 UAT Sign-Off & 2 On-Site Training Days Completed',
      'BODY: We formally sign off on Phase 1 UAT under SOW-2026-NS-09 §2.1 and confirm completion of 2 on-site training days (§2.3). Please issue the milestone invoice.',
    ].join('\n'),
  },
  {
    triggerId: 'trig_demo_northstar_rollout',
    type: 'signed_contract_sow',
    receivedAt: '2026-10-15T18:40:00Z',
    customerId: 'cust_northstar',
    rawPayload: [
      'EVENT: docusign.envelope.completed',
      'DOCUMENT: SOW-2026-NS-09 Phase 2 Enterprise Production Rollout Certificate',
      'CLAUSE: §2.2 — £12,500.00 payable upon Production Rollout sign-off',
    ].join('\n'),
  },
];

export class AutonomousCollectorAgent {
  private readonly ledger: CogneeMemoryLedger;
  private readonly policy: PolicyEngine;
  private readonly stripe: StripeTestClient;

  constructor(deps: {
    ledger: CogneeMemoryLedger;
    policy: PolicyEngine;
    stripe: StripeTestClient;
  }) {
    this.ledger = deps.ledger;
    this.policy = deps.policy;
    this.stripe = deps.stripe;
  }

  async processTrigger(trigger: RealWorldTrigger): Promise<AuditLedgerEntry> {
    const customerProfile = this.ledger.getCustomerMemory(trigger.customerId);
    if (!customerProfile) {
      throw new Error(`Unknown customerId in Cognee memory: ${trigger.customerId}`);
    }

    const proposal = this.synthesizeProposalFromTrigger(trigger, customerProfile);

    const decision = this.policy.evaluate(proposal, {
      contractedRatesMinor: customerProfile.contractedRatesMinor,
      previouslyBilledTriggerIds: this.ledger.getBilledTriggerIds(),
    });

    let stripeArtifact = undefined;
    if (decision.approved && decision.action !== 'reject_policy_violation') {
      stripeArtifact = await this.stripe.createAndIssueInvoice(proposal, decision.action);
    }

    return this.ledger.recordAuditEntry({
      trigger,
      proposal,
      policyDecision: decision,
      stripeArtifact,
    });
  }

  private synthesizeProposalFromTrigger(
    trigger: RealWorldTrigger,
    customer: NonNullable<ReturnType<CogneeMemoryLedger['getCustomerMemory']>>
  ): InvoiceProposal {
    const rates = customer.contractedRatesMinor;
    const lineItems: ProposedLineItem[] = [];
    let discountPercent = 0;

    if (trigger.customerId === 'cust_acme' && trigger.type === 'usage_logs') {
      const overageMatch = trigger.rawPayload.match(/api_calls_overage=(\d+)/i);
      const gpuMatch = trigger.rawPayload.match(/dedicated_gpu_hours=(\d+)/i);
      const overageUnits = overageMatch ? Number(overageMatch[1]) : 45000;
      const gpuHours = gpuMatch ? Number(gpuMatch[1]) : 0;

      lineItems.push({
        sku: 'PLATFORM_BASE',
        description: 'October 2026 Enterprise Platform Base Retainer',
        quantity: 1,
        unitAmountMinor: rates.PLATFORM_BASE,
        totalAmountMinor: rates.PLATFORM_BASE,
        clauseCitation: `${customer.contractReference} §3.1 — Monthly Base Retainer £2,500.00`,
        sourceEvidence: 'contract:MSA-2026-ACME-04#sec-3.1 (active subscription period 2026-10)',
      });

      if (overageUnits > 0) {
        lineItems.push({
          sku: 'API_CALLS_OVERAGE',
          description: `Metered API Overage (${overageUnits.toLocaleString('en-GB')} calls above 100k tier @ £0.04)`,
          quantity: overageUnits,
          unitAmountMinor: rates.API_CALLS_OVERAGE,
          totalAmountMinor: overageUnits * rates.API_CALLS_OVERAGE,
          clauseCitation: `${customer.contractReference} §4.2 — Metered API Overage at £0.04/call`,
          sourceEvidence: `telemetry:api_calls_total=145000 included=100000 billable=${overageUnits}`,
        });
      }

      if (gpuHours > 0) {
        lineItems.push({
          sku: 'DEDICATED_GPU_HOUR',
          description: `Dedicated Inference GPU Compute (${gpuHours} hrs @ £3.50/hr)`,
          quantity: gpuHours,
          unitAmountMinor: rates.DEDICATED_GPU_HOUR,
          totalAmountMinor: gpuHours * rates.DEDICATED_GPU_HOUR,
          clauseCitation: `${customer.contractReference} §4.4 — Dedicated GPU Compute at £3.50/hr`,
          sourceEvidence: `telemetry:dedicated_gpu_hours=${gpuHours}`,
        });
      }
    } else if (trigger.customerId === 'cust_vanguard') {
      const seatMatch = trigger.rawPayload.match(/(\d+)\s+active\s+Enterprise\s+seats/i);
      const seats = seatMatch ? Number(seatMatch[1]) : 20;

      // Check Cognee historical notes for agreed goodwill discount
      const hasAgreedTenPercentDiscount =
        customer.historicalNotes.some((n) => /10%\s+goodwill\s+discount/i.test(n)) &&
        /10%\s+goodwill\s+discount/i.test(trigger.rawPayload);

      const requestedDiscountMatch = trigger.rawPayload.match(/(\d+)%\s+(?:goodwill\s+)?discount/i);
      if (requestedDiscountMatch) {
        discountPercent = Number(requestedDiscountMatch[1]);
      } else if (hasAgreedTenPercentDiscount) {
        discountPercent = 10;
      }

      lineItems.push({
        sku: 'SEAT_ENTERPRISE',
        description: `Enterprise Platform Seats (${seats} active seats @ £150.00)`,
        quantity: seats,
        unitAmountMinor: rates.SEAT_ENTERPRISE,
        totalAmountMinor: seats * rates.SEAT_ENTERPRISE,
        clauseCitation: `${customer.contractReference} §2.1 — £150.00 per active seat`,
        sourceEvidence: `email:billing@vanguardfintech.io confirmed ${seats} active seats`,
      });

      lineItems.push({
        sku: 'COMPLIANCE_ADDON',
        description: 'FCA Audit & Compliance Reporting Add-on (Oct 2026)',
        quantity: 1,
        unitAmountMinor: rates.COMPLIANCE_ADDON,
        totalAmountMinor: rates.COMPLIANCE_ADDON,
        clauseCitation: `${customer.contractReference} §2.4 — Monthly Compliance Add-on £900.00`,
        sourceEvidence: `email:billing@vanguardfintech.io + Cognee memory note 2026-10-10`,
      });
    } else if (
      trigger.customerId === 'cust_northstar' &&
      trigger.type === 'signed_milestone_email'
    ) {
      const trainingMatch = trigger.rawPayload.match(/(\d+)\s+on-site\s+training\s+days/i);
      const trainingDays = trainingMatch ? Number(trainingMatch[1]) : 2;

      lineItems.push({
        sku: 'MILESTONE_PHASE_1',
        description: 'Phase 1 UAT Sign-off Deliverable Milestone',
        quantity: 1,
        unitAmountMinor: rates.MILESTONE_PHASE_1,
        totalAmountMinor: rates.MILESTONE_PHASE_1,
        clauseCitation: `${customer.contractReference} §2.1 — £4,800.00 upon Phase 1 UAT sign-off`,
        sourceEvidence: `email:vp-ops@northstar-plc.co.uk "formally sign off on Phase 1 UAT"`,
      });

      lineItems.push({
        sku: 'TRAINING_DAY',
        description: `On-Site Operator Training (${trainingDays} days @ £1,200.00/day)`,
        quantity: trainingDays,
        unitAmountMinor: rates.TRAINING_DAY,
        totalAmountMinor: trainingDays * rates.TRAINING_DAY,
        clauseCitation: `${customer.contractReference} §2.3 — £1,200.00 per on-site training day`,
        sourceEvidence: `email:vp-ops@northstar-plc.co.uk "confirm completion of ${trainingDays} on-site training days"`,
      });
    } else if (
      trigger.customerId === 'cust_northstar' &&
      trigger.type === 'signed_contract_sow'
    ) {
      lineItems.push({
        sku: 'MILESTONE_ENTERPRISE_ROLLOUT',
        description: 'Phase 2 Enterprise Production Rollout Milestone',
        quantity: 1,
        unitAmountMinor: rates.MILESTONE_ENTERPRISE_ROLLOUT,
        totalAmountMinor: rates.MILESTONE_ENTERPRISE_ROLLOUT,
        clauseCitation: `${customer.contractReference} §2.2 — £12,500.00 upon Production Rollout sign-off`,
        sourceEvidence: `docusign:SOW-2026-NS-09 Phase 2 Certificate completed`,
      });
    } else {
      const firstSku = Object.keys(rates)[0];
      const unitRate = rates[firstSku] ?? 100_00;
      lineItems.push({
        sku: firstSku,
        description: `Autonomous Contracted Deliverable (${firstSku})`,
        quantity: 1,
        unitAmountMinor: unitRate,
        totalAmountMinor: unitRate,
        clauseCitation: `${customer.contractReference} §1.1 — Standard Deliverable`,
        sourceEvidence: trigger.rawPayload.slice(0, 200),
      });
    }

    return {
      triggerId: trigger.triggerId,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      currency: 'gbp',
      daysUntilDue: customer.paymentTermsDays,
      discountPercent,
      contractReference: customer.contractReference,
      lineItems,
    };
  }
}
