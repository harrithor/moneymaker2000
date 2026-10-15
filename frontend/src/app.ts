import { AutonomousCollectorAgent, DEMO_TRIGGERS } from './collector-agent.ts';
import {
  buildLumenFaqFromPolicy,
  loadLumenPolicyMarkdown,
  parseBackendServerLogEvents,
} from './lumen-bridge.ts';
import { CogneeMemoryLedger } from './memory-ledger.ts';
import { DEFAULT_BILLING_POLICY, PolicyEngine } from './policy.ts';
import { StripeTestClient } from './stripe-client.ts';
import type { AuditLedgerEntry, RealWorldTrigger } from './types.ts';

export function createAppController(options?: {
  stripeSecretKey?: string;
  cogneeApiKey?: string;
}) {
  const ledger = new CogneeMemoryLedger({ cogneeApiKey: options?.cogneeApiKey });
  const policy = new PolicyEngine(DEFAULT_BILLING_POLICY);
  const stripe = new StripeTestClient({ stripeSecretKey: options?.stripeSecretKey });
  const agent = new AutonomousCollectorAgent({ ledger, policy, stripe });
  const lumenPolicyMarkdown = loadLumenPolicyMarkdown();
  const faq = buildLumenFaqFromPolicy(lumenPolicyMarkdown);

  return {
    getState() {
      return {
        stripeLiveTestConfigured: stripe.isLiveTestApiConfigured(),
        policy: policy.getPolicy(),
        lumenPolicyMarkdown,
        faq,
        backendLiveEvents: parseBackendServerLogEvents(),
        customers: ledger.listCustomers(),
        demoTriggers: DEMO_TRIGGERS,
        auditEntries: ledger.listAuditEntries(),
        cogneeMemoryNodes: ledger.listMemoryNodes(),
      };
    },

    async runDemoTrigger(triggerId: string): Promise<AuditLedgerEntry> {
      const found = DEMO_TRIGGERS.find((t) => t.triggerId === triggerId);
      if (!found) {
        throw new Error(`Demo trigger ${triggerId} not found`);
      }
      return agent.processTrigger(found);
    },

    async runCustomTrigger(trigger: RealWorldTrigger): Promise<AuditLedgerEntry> {
      return agent.processTrigger(trigger);
    },

    explainEntry(entryId: string, question: string) {
      return ledger.explainInvoice(entryId, question);
    },

    configureStripeKey(stripeSecretKey: string) {
      stripe.setStripeSecretKey(stripeSecretKey);
      return {
        stripeLiveTestConfigured: stripe.isLiveTestApiConfigured(),
      };
    },
  };
}
