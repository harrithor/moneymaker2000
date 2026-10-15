# Briefcase × Stripe Hackathon (Oct 2026) — Track 02: Autonomous Revenue Collector

An autonomous AI revenue & invoicing agent that turns real-world triggers (telemetry usage logs, UAT sign-off emails, signed SOW milestones, and collections dispute notes) into real **Stripe Test Mode** invoices under strict policy guardrails—and can **explain every pound** from **Cognee** memory.

## Why It Wins All 4 Judging Criteria + Side Quest

1. **Works End-to-End (35 pts):** Connects directly to `https://api.stripe.com/v1` using your `sk_test_...` key (`src/stripe-client.ts`) to create real Stripe Test Mode Customers (`cus_...`), Invoice Items (`ii_...`) annotated with contract clause citations, and finalized Invoices (`in_...`) with a live `hosted_invoice_url`.
2. **Autonomy with Control (25 pts):** Enforces deterministic revenue guardrails (`src/policy.ts`):
   - `POL-LIMIT-001`: Auto-finalizes & sends invoices $\le$ £10,000; holds invoices $>$ £10,000 as Stripe drafts for CFO sign-off.
   - `POL-DISC-002`: Blocks unauthorized autonomous discounts exceeding 15%.
   - `POL-DUP-003`: Idempotency guard prevents double-billing the same trigger event.
   - `POL-RATE-004`: Verifies every line item unit price against the customer's contracted rate card in Cognee memory.
   - `POL-EVID-005`: Mandates a contract clause citation and verifiable source evidence on every line item.
3. **Explains Every Pound (20 pts):** Every invoice records a pound-by-pound audit ledger entry (`src/memory-ledger.ts`) linking each line item to its exact contract clause and trigger evidence.
4. **Side Quest — Best Use of Cognee Memory:** Stores customer contracts, rate cards, and historical dispute promises in a shared memory graph (with optional live sync to Cognee Cloud via `COGNEE_API_KEY`).

## Quick Start (Zero External Dependencies — Node 22.6+ / Node 24)

```bash
# Run the test suite
npm test

# Start the interactive dashboard on http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_key_here npm start
```

Or start with `npm start` and paste your `sk_test_...` key directly into the top bar of the web UI at `http://localhost:3000`.
