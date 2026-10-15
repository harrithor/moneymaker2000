import type {
  BillingPolicy,
  CurrencyCode,
  InvoiceProposal,
  PolicyCheckResult,
  PolicyDecision,
} from './types.ts';

export const DEFAULT_BILLING_POLICY: BillingPolicy = {
  policyId: 'BRIEFCASE-REV-POLICY-2026-V1',
  maxAutoFinalizeAmountMinor: 1_000_000, // £10,000.00 auto-finalize cap
  maxDiscountPercent: 15, // Max 15% autonomous discount
  allowedCurrencies: ['gbp', 'usd', 'eur'],
  requireContractCitation: true,
};

export interface PolicyEvaluationContext {
  contractedRatesMinor: Record<string, number>;
  previouslyBilledTriggerIds: Set<string>;
}

export class PolicyEngine {
  private readonly policy: BillingPolicy;

  constructor(policy: BillingPolicy = DEFAULT_BILLING_POLICY) {
    this.policy = policy;
  }

  getPolicy(): BillingPolicy {
    return this.policy;
  }

  evaluate(proposal: InvoiceProposal, context: PolicyEvaluationContext): PolicyDecision {
    const grossTotalMinor = proposal.lineItems.reduce(
      (sum, item) => sum + item.totalAmountMinor,
      0
    );
    const discountAmountMinor = Math.round(
      (grossTotalMinor * proposal.discountPercent) / 100
    );
    const netTotalMinor = grossTotalMinor - discountAmountMinor;

    const checks: PolicyCheckResult[] = [];

    // Rule 1: Duplicate trigger billing check (POL-DUP-003)
    const isDuplicate = context.previouslyBilledTriggerIds.has(proposal.triggerId);
    checks.push({
      ruleId: 'POL-DUP-003',
      ruleName: 'Idempotent Trigger Guard',
      passed: !isDuplicate,
      severity: 'block',
      reason: isDuplicate
        ? `Trigger ${proposal.triggerId} has already been billed; blocking duplicate invoice.`
        : `Trigger ${proposal.triggerId} is unique and unbilled.`,
    });

    // Rule 2: Discount cap check (POL-DISC-002)
    const discountOk =
      proposal.discountPercent >= 0 &&
      proposal.discountPercent <= this.policy.maxDiscountPercent;
    checks.push({
      ruleId: 'POL-DISC-002',
      ruleName: 'Autonomous Discount Cap',
      passed: discountOk,
      severity: 'block',
      reason: discountOk
        ? `Discount ${proposal.discountPercent}% is within policy cap (${this.policy.maxDiscountPercent}%).`
        : `Discount ${proposal.discountPercent}% exceeds autonomous policy limit of ${this.policy.maxDiscountPercent}%.`,
    });

    // Rule 3: Contracted Rate Card Verification (POL-RATE-004)
    const mismatchedItems = proposal.lineItems.filter((item) => {
      const expectedRate = context.contractedRatesMinor[item.sku];
      const mathCorrect = item.quantity * item.unitAmountMinor === item.totalAmountMinor;
      return expectedRate === undefined || expectedRate !== item.unitAmountMinor || !mathCorrect;
    });
    const ratesOk = mismatchedItems.length === 0;
    checks.push({
      ruleId: 'POL-RATE-004',
      ruleName: 'Contracted Rate Card Verification',
      passed: ratesOk,
      severity: 'block',
      reason: ratesOk
        ? `All ${proposal.lineItems.length} line item(s) match contracted rate card (${proposal.contractReference}).`
        : `Rate card mismatch on SKU(s): ${mismatchedItems.map((i) => i.sku).join(', ')}.`,
    });

    // Rule 4: Evidence & Clause Citation Mandate (POL-EVID-005)
    const missingCitation = this.policy.requireContractCitation
      ? proposal.lineItems.some(
          (i) => !i.clauseCitation.trim() || !i.sourceEvidence.trim()
        )
      : false;
    checks.push({
      ruleId: 'POL-EVID-005',
      ruleName: 'Explain-Every-Pound Evidence Requirement',
      passed: !missingCitation,
      severity: 'block',
      reason: !missingCitation
        ? 'Every line item carries a contract clause citation and verifiable trigger evidence.'
        : 'One or more line items lack a clause citation or source evidence.',
    });

    // Rule 5: Auto-Finalize Threshold (POL-LIMIT-001)
    const withinAutoLimit = netTotalMinor <= this.policy.maxAutoFinalizeAmountMinor;
    checks.push({
      ruleId: 'POL-LIMIT-001',
      ruleName: 'Autonomous Finalization Ceiling',
      passed: withinAutoLimit,
      severity: 'hold_draft',
      reason: withinAutoLimit
        ? `Net total £${(netTotalMinor / 100).toFixed(2)} is within £${(
            this.policy.maxAutoFinalizeAmountMinor / 100
          ).toFixed(2)} auto-finalize ceiling.`
        : `Net total £${(netTotalMinor / 100).toFixed(2)} exceeds £${(
            this.policy.maxAutoFinalizeAmountMinor / 100
          ).toFixed(2)} auto-finalize ceiling; holding as Stripe draft invoice for CFO sign-off.`,
    });

    const hasBlockingFailure = checks.some((c) => !c.passed && c.severity === 'block');
    const hasDraftHold = checks.some((c) => !c.passed && c.severity === 'hold_draft');

    if (hasBlockingFailure) {
      return {
        approved: false,
        action: 'reject_policy_violation',
        grossTotalMinor,
        discountAmountMinor,
        netTotalMinor,
        checks,
      };
    }

    if (hasDraftHold) {
      return {
        approved: true,
        action: 'hold_draft_for_approval',
        grossTotalMinor,
        discountAmountMinor,
        netTotalMinor,
        checks,
      };
    }

    return {
      approved: true,
      action: 'auto_finalize_and_send',
      grossTotalMinor,
      discountAmountMinor,
      netTotalMinor,
      checks,
    };
  }
}
