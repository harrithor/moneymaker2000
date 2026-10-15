import type {
  AuditLedgerEntry,
  InvoiceProposal,
  PolicyDecision,
  RealWorldTrigger,
  StripeTestInvoiceArtifact,
} from './types.ts';

export interface CustomerMemoryProfile {
  customerId: string;
  customerName: string;
  customerEmail: string;
  contractReference: string;
  paymentTermsDays: number;
  contractedRatesMinor: Record<string, number>;
  historicalNotes: string[];
}

export interface CogneeMemoryNode {
  nodeId: string;
  dataset: 'contracts' | 'usage_evidence' | 'billing_audit' | 'collections_history';
  entityType: 'CustomerContract' | 'TriggerEvidence' | 'InvoiceAudit' | 'DisputeResolution';
  customerId: string;
  summary: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}

const SEEDED_CUSTOMERS: Record<string, CustomerMemoryProfile> = {
  cust_acme: {
    customerId: 'cust_acme',
    customerName: 'Acme Robotics Ltd',
    customerEmail: 'ap@acmerobotics.co.uk',
    contractReference: 'MSA-2026-ACME-04',
    paymentTermsDays: 14,
    contractedRatesMinor: {
      PLATFORM_BASE: 250_000, // £2,500.00 / month
      API_CALLS_OVERAGE: 4, // £0.04 / call over 100k included tier
      DEDICATED_GPU_HOUR: 350, // £3.50 / GPU hour
    },
    historicalNotes: [
      'MSA signed 2026-04-01: £2,500/mo base includes 100,000 API calls. Overage billed at £0.04/call.',
      'CFO requested clear breakdown of raw telemetry window on every overage invoice.',
    ],
  },
  cust_northstar: {
    customerId: 'cust_northstar',
    customerName: 'Northstar Logistics PLC',
    customerEmail: 'finance@northstar-plc.co.uk',
    contractReference: 'SOW-2026-NS-09',
    paymentTermsDays: 30,
    contractedRatesMinor: {
      MILESTONE_PHASE_1: 480_000, // £4,800.00 on Phase 1 UAT sign-off
      MILESTONE_ENTERPRISE_ROLLOUT: 1_250_000, // £12,500.00 on Phase 2 production rollout
      TRAINING_DAY: 120_000, // £1,200.00 / day
    },
    historicalNotes: [
      'SOW-2026-NS-09 §2.1: Phase 1 UAT sign-off triggers £4,800.00 milestone invoice.',
      'SOW-2026-NS-09 §2.2: Phase 2 Production Rollout triggers £12,500.00 invoice (exceeds £10k auto-finalize limit -> hold draft).',
    ],
  },
  cust_vanguard: {
    customerId: 'cust_vanguard',
    customerName: 'Vanguard FinTech Group',
    customerEmail: 'billing@vanguardfintech.io',
    contractReference: 'MSA-2026-VFG-11',
    paymentTermsDays: 7,
    contractedRatesMinor: {
      SEAT_ENTERPRISE: 15_000, // £150.00 / seat
      COMPLIANCE_ADDON: 90_000, // £900.00 flat
    },
    historicalNotes: [
      'Customer disputed Sept seat count (claimed 20 active seats instead of 25). Agreed in email on 2026-10-10 to apply a 10% goodwill discount on October renewal.',
    ],
  },
};

export class CogneeMemoryLedger {
  private readonly customers = new Map<string, CustomerMemoryProfile>();
  private readonly memoryNodes = new Map<string, CogneeMemoryNode>();
  private readonly auditEntries: AuditLedgerEntry[] = [];
  private readonly billedTriggerIds = new Set<string>();
  private readonly cogneeApiKey?: string;

  constructor(options?: { cogneeApiKey?: string }) {
    this.cogneeApiKey = options?.cogneeApiKey ?? process.env.COGNEE_API_KEY;
    for (const profile of Object.values(SEEDED_CUSTOMERS)) {
      this.customers.set(profile.customerId, profile);
      const contractNodeId = `cognee_contract_${profile.customerId}`;
      this.memoryNodes.set(contractNodeId, {
        nodeId: contractNodeId,
        dataset: 'contracts',
        entityType: 'CustomerContract',
        customerId: profile.customerId,
        summary: `${profile.customerName} (${profile.contractReference}) — contracted rate card and historical billing memory`,
        attributes: {
          contractReference: profile.contractReference,
          contractedRatesMinor: profile.contractedRatesMinor,
          historicalNotes: profile.historicalNotes,
        },
        createdAt: '2026-10-15T18:00:00Z',
      });
    }
  }

  getCustomerMemory(customerId: string): CustomerMemoryProfile | undefined {
    return this.customers.get(customerId);
  }

  listCustomers(): CustomerMemoryProfile[] {
    return Array.from(this.customers.values());
  }

  getBilledTriggerIds(): Set<string> {
    return new Set(this.billedTriggerIds);
  }

  listAuditEntries(): AuditLedgerEntry[] {
    return [...this.auditEntries];
  }

  listMemoryNodes(customerId?: string): CogneeMemoryNode[] {
    const all = Array.from(this.memoryNodes.values());
    return customerId ? all.filter((n) => n.customerId === customerId) : all;
  }

  async recordAuditEntry(params: {
    trigger: RealWorldTrigger;
    proposal: InvoiceProposal;
    policyDecision: PolicyDecision;
    stripeArtifact?: StripeTestInvoiceArtifact;
  }): Promise<AuditLedgerEntry> {
    const { trigger, proposal, policyDecision, stripeArtifact } = params;
    const entryId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    if (policyDecision.approved) {
      this.billedTriggerIds.add(trigger.triggerId);
    }

    const contractNodeId = `cognee_contract_${proposal.customerId}`;
    const triggerNodeId = `cognee_trig_${trigger.triggerId}`;
    const auditNodeId = `cognee_${entryId}`;

    this.memoryNodes.set(triggerNodeId, {
      nodeId: triggerNodeId,
      dataset: 'usage_evidence',
      entityType: 'TriggerEvidence',
      customerId: proposal.customerId,
      summary: `Real-world trigger (${trigger.type}) received at ${trigger.receivedAt}`,
      attributes: {
        triggerId: trigger.triggerId,
        rawPayload: trigger.rawPayload,
      },
      createdAt: now,
    });

    const poundByPoundExplanation = this.buildPoundByPoundExplanation(
      proposal,
      policyDecision,
      stripeArtifact
    );

    this.memoryNodes.set(auditNodeId, {
      nodeId: auditNodeId,
      dataset: 'billing_audit',
      entityType: 'InvoiceAudit',
      customerId: proposal.customerId,
      summary: `Audit trail for ${proposal.customerName}: £${(
        policyDecision.netTotalMinor / 100
      ).toFixed(2)} (${policyDecision.action})`,
      attributes: {
        entryId,
        contractReference: proposal.contractReference,
        netTotalMinor: policyDecision.netTotalMinor,
        action: policyDecision.action,
        stripeInvoiceId: stripeArtifact?.stripeInvoiceId ?? null,
      },
      createdAt: now,
    });

    if (this.cogneeApiKey) {
      await this.syncToCogneeCloud(auditNodeId, poundByPoundExplanation).catch(() => {
        // Non-blocking fallback so local knowledge graph always succeeds
      });
    }

    const entry: AuditLedgerEntry = {
      entryId,
      timestamp: now,
      trigger,
      proposal,
      policyDecision,
      stripeArtifact,
      cogneeMemoryNodeIds: [contractNodeId, triggerNodeId, auditNodeId],
      poundByPoundExplanation,
    };

    this.auditEntries.unshift(entry);
    return entry;
  }

  explainInvoice(
    entryId: string,
    question: string
  ): {
    entryId: string;
    question: string;
    explanation: string;
    memoryNodesConsulted: CogneeMemoryNode[];
  } {
    const entry = this.auditEntries.find((e) => e.entryId === entryId);
    if (!entry) {
      throw new Error(`Audit entry ${entryId} not found`);
    }

    const consultedNodes = entry.cogneeMemoryNodeIds
      .map((id) => this.memoryNodes.get(id))
      .filter((n): n is CogneeMemoryNode => Boolean(n));

    const itemBreakdowns = entry.proposal.lineItems
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.sku}] ${item.description}: ${item.quantity.toLocaleString('en-GB')} × ${this.formatGbp(
            item.unitAmountMinor
          )} = ${this.formatGbp(item.totalAmountMinor)} | Authorised by: ${
            item.clauseCitation
          } | Evidence: ${item.sourceEvidence}`
      )
      .join('\n');

    const explanation = [
      `Query: "${question}"`,
      `Customer: ${entry.proposal.customerName} (${entry.proposal.contractReference})`,
      `Autonomous Decision: ${entry.policyDecision.action} (Net Total: ${this.formatGbp(
        entry.policyDecision.netTotalMinor
      )})`,
      `Line-by-Line Justification from Cognee Memory:`,
      itemBreakdowns,
      entry.stripeArtifact
        ? `Stripe Test Mode Proof: Invoice ${entry.stripeArtifact.stripeInvoiceId} (${entry.stripeArtifact.status}) -> ${entry.stripeArtifact.hostedInvoiceUrl}`
        : `Stripe Test Mode Proof: Blocked prior to Stripe invocation due to policy guardrails.`,
    ].join('\n');

    return {
      entryId,
      question,
      explanation,
      memoryNodesConsulted: consultedNodes,
    };
  }

  private formatGbp(minor: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(minor / 100);
  }

  private buildPoundByPoundExplanation(
    proposal: InvoiceProposal,
    decision: PolicyDecision,
    stripeArtifact?: StripeTestInvoiceArtifact
  ): string {
    const lines: string[] = [
      `=== EXPLAIN EVERY POUND: ${proposal.customerName} (${proposal.contractReference}) ===`,
    ];

    for (const item of proposal.lineItems) {
      const unitGbp = this.formatGbp(item.unitAmountMinor);
      const totalGbp = this.formatGbp(item.totalAmountMinor);
      lines.push(
        `• ${totalGbp} — ${item.description} (${item.quantity.toLocaleString('en-GB')} units @ ${unitGbp})`
      );
      lines.push(`  ↳ Clause: ${item.clauseCitation}`);
      lines.push(`  ↳ Evidence: ${item.sourceEvidence}`);
    }

    if (proposal.discountPercent > 0) {
      lines.push(
        `• Discount Applied: -${this.formatGbp(decision.discountAmountMinor)} (${proposal.discountPercent}% per historical memory)`
      );
    }

    lines.push(
      `• Net Total: ${this.formatGbp(decision.netTotalMinor)} | Policy Action: ${decision.action}`
    );

    if (stripeArtifact) {
      lines.push(
        `• Stripe Test Mode Invoice: ${stripeArtifact.stripeInvoiceId} [${stripeArtifact.status.toUpperCase()}]`
      );
    }

    return lines.join('\n');
  }

  private async syncToCogneeCloud(nodeId: string, text: string): Promise<void> {
    if (!this.cogneeApiKey) return;
    await fetch('https://api.cognee.ai/v1/add', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cogneeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataset_name: 'briefcase_stripe_track2', data: text, node_id: nodeId }),
    });
  }
}
