export type CurrencyCode = 'gbp' | 'usd' | 'eur';

export interface ProposedLineItem {
  sku: string;
  description: string;
  quantity: number;
  unitAmountMinor: number; // in pence/cents
  totalAmountMinor: number; // quantity * unitAmountMinor
  clauseCitation: string;
  sourceEvidence: string;
}

export interface InvoiceProposal {
  triggerId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  currency: CurrencyCode;
  daysUntilDue: number;
  discountPercent: number;
  contractReference: string;
  lineItems: ProposedLineItem[];
}

export interface BillingPolicy {
  policyId: string;
  maxAutoFinalizeAmountMinor: number; // e.g., £10,000 = 1_000_000 pence
  maxDiscountPercent: number; // e.g., 15%
  allowedCurrencies: CurrencyCode[];
  requireContractCitation: boolean;
}

export interface PolicyCheckResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: 'block' | 'hold_draft';
  reason: string;
}

export type PolicyAction =
  | 'auto_finalize_and_send'
  | 'hold_draft_for_approval'
  | 'reject_policy_violation';

export interface PolicyDecision {
  approved: boolean;
  action: PolicyAction;
  grossTotalMinor: number;
  discountAmountMinor: number;
  netTotalMinor: number;
  checks: PolicyCheckResult[];
}

export interface RealWorldTrigger {
  triggerId: string;
  type: 'usage_logs' | 'signed_milestone_email' | 'signed_contract_sow' | 'collections_dispute_note';
  receivedAt: string;
  customerId: string;
  rawPayload: string;
  metadata?: Record<string, string | number>;
}

export interface StripeTestInvoiceArtifact {
  mode: 'live_stripe_test_api' | 'simulated_stripe_test_mode';
  stripeCustomerId: string;
  stripeInvoiceId: string;
  stripeInvoiceItemIds: string[];
  status: 'open' | 'draft' | 'paid';
  amountDueMinor: number;
  currency: CurrencyCode;
  hostedInvoiceUrl: string;
  invoicePdfUrl: string;
}

export interface AuditLedgerEntry {
  entryId: string;
  timestamp: string;
  trigger: RealWorldTrigger;
  proposal: InvoiceProposal;
  policyDecision: PolicyDecision;
  stripeArtifact?: StripeTestInvoiceArtifact;
  cogneeMemoryNodeIds: string[];
  poundByPoundExplanation: string;
}
