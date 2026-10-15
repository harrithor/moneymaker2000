import type {
  InvoiceProposal,
  PolicyAction,
  StripeTestInvoiceArtifact,
} from './types.ts';

export class StripeTestClient {
  private stripeSecretKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(options?: { stripeSecretKey?: string; fetchImpl?: typeof fetch }) {
    const key = (options?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY ?? '').trim();
    this.validateKey(key);
    this.stripeSecretKey = key;
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  private validateKey(key: string): void {
    if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
      throw new Error(
        'Stripe test mode only (Rule 3): Live API keys (sk_live_*) are strictly forbidden.'
      );
    }
  }

  setStripeSecretKey(key: string): void {
    const trimmed = key.trim();
    this.validateKey(trimmed);
    this.stripeSecretKey = trimmed;
  }

  isLiveTestApiConfigured(): boolean {
    return (
      this.stripeSecretKey.startsWith('sk_test_') ||
      this.stripeSecretKey.startsWith('rk_test_')
    );
  }

  async createAndIssueInvoice(
    proposal: InvoiceProposal,
    action: Exclude<PolicyAction, 'reject_policy_violation'>
  ): Promise<StripeTestInvoiceArtifact> {
    const grossMinor = proposal.lineItems.reduce(
      (sum, item) => sum + item.totalAmountMinor,
      0
    );
    const discountMinor = Math.round((grossMinor * proposal.discountPercent) / 100);
    const netMinor = grossMinor - discountMinor;

    if (!this.isLiveTestApiConfigured()) {
      const suffix = Math.random().toString(36).slice(2, 8);
      const status = action === 'auto_finalize_and_send' ? 'open' : 'draft';
      return {
        mode: 'simulated_stripe_test_mode',
        stripeCustomerId: `cus_test_${proposal.customerId}_${suffix}`,
        stripeInvoiceId: `in_test_${suffix}`,
        stripeInvoiceItemIds: proposal.lineItems.map((_, i) => `ii_test_${suffix}_${i + 1}`),
        status,
        amountDueMinor: netMinor,
        currency: proposal.currency,
        hostedInvoiceUrl: `https://dashboard.stripe.com/test/invoices/in_test_${suffix}`,
        invoicePdfUrl: `https://dashboard.stripe.com/test/invoices/in_test_${suffix}/pdf`,
      };
    }

    // 1. Create Stripe Customer in Test Mode
    const customerParams = new URLSearchParams({
      name: proposal.customerName,
      email: proposal.customerEmail,
      description: `Briefcase Autonomous Collector (${proposal.contractReference})`,
      'metadata[customer_id]': proposal.customerId,
      'metadata[contract_reference]': proposal.contractReference,
    });
    const customer = await this.postStripe<{ id: string }>('/customers', customerParams);

    // 2. Create Draft Stripe Invoice first so InvoiceItems attach cleanly
    const invoiceParams = new URLSearchParams({
      customer: customer.id,
      currency: proposal.currency,
      collection_method: 'send_invoice',
      days_until_due: String(proposal.daysUntilDue),
      description: `Autonomous Invoice — ${proposal.contractReference} (Trigger: ${proposal.triggerId})`,
      'metadata[trigger_id]': proposal.triggerId,
      'metadata[contract_reference]': proposal.contractReference,
      'metadata[policy_action]': action,
    });
    const draftInvoice = await this.postStripe<{
      id: string;
      status: string;
      amount_due: number;
      hosted_invoice_url?: string;
      invoice_pdf?: string;
    }>('/invoices', invoiceParams);

    // 3. Attach each line item with its contract clause citation in metadata
    const itemIds: string[] = [];
    for (const item of proposal.lineItems) {
      const itemParams = new URLSearchParams({
        customer: customer.id,
        invoice: draftInvoice.id,
        currency: proposal.currency,
        amount: String(item.totalAmountMinor),
        description: `${item.description} [${item.clauseCitation}]`,
        'metadata[sku]': item.sku,
        'metadata[clause_citation]': item.clauseCitation,
        'metadata[source_evidence]': item.sourceEvidence.slice(0, 450),
      });
      const createdItem = await this.postStripe<{ id: string }>('/invoiceitems', itemParams);
      itemIds.push(createdItem.id);
    }

    // Attach discount line item if applicable
    if (discountMinor > 0) {
      const discParams = new URLSearchParams({
        customer: customer.id,
        invoice: draftInvoice.id,
        currency: proposal.currency,
        amount: String(-discountMinor),
        description: `Agreed Commercial Discount (${proposal.discountPercent}%) — verified in Cognee Memory`,
      });
      const discItem = await this.postStripe<{ id: string }>('/invoiceitems', discParams);
      itemIds.push(discItem.id);
    }

    // 4. Finalize if policy approved auto_finalize_and_send
    if (action === 'auto_finalize_and_send') {
      const finalized = await this.postStripe<{
        id: string;
        status: string;
        amount_due: number;
        hosted_invoice_url?: string;
        invoice_pdf?: string;
      }>(`/invoices/${draftInvoice.id}/finalize`, new URLSearchParams());

      return {
        mode: 'live_stripe_test_api',
        stripeCustomerId: customer.id,
        stripeInvoiceId: finalized.id,
        stripeInvoiceItemIds: itemIds,
        status: 'open',
        amountDueMinor: finalized.amount_due ?? netMinor,
        currency: proposal.currency,
        hostedInvoiceUrl:
          finalized.hosted_invoice_url ??
          `https://dashboard.stripe.com/test/invoices/${finalized.id}`,
        invoicePdfUrl:
          finalized.invoice_pdf ??
          `https://dashboard.stripe.com/test/invoices/${finalized.id}`,
      };
    }

    return {
      mode: 'live_stripe_test_api',
      stripeCustomerId: customer.id,
      stripeInvoiceId: draftInvoice.id,
      stripeInvoiceItemIds: itemIds,
      status: 'draft',
      amountDueMinor: netMinor,
      currency: proposal.currency,
      hostedInvoiceUrl: `https://dashboard.stripe.com/test/invoices/${draftInvoice.id}`,
      invoicePdfUrl: `https://dashboard.stripe.com/test/invoices/${draftInvoice.id}`,
    };
  }

  private async postStripe<T>(path: string, body: URLSearchParams): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(
        `Stripe Test API error (${response.status}): ${
          data?.error?.message ?? JSON.stringify(data)
        }`
      );
    }
    return data;
  }
}
