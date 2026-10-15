# Lumen & Lode × Briefcase × Stripe — Track 02 ("Agents that collect")

Unified **Email-to-Invoice + Cognee Memory + Policy Guardrails + Stripe Test Mode** autonomous revenue collection agent built for the **Briefcase × Stripe Hackathon (Track 02)**.

## Unified Architecture

```
Inbound Resend Email + Image Mock-Up (`image.png`)
   │
   ▼
[1. Multimodal Email-to-Invoice Engine (`backend/email-machinery/app/main.py` & `frontend/src/lumen-bridge.ts`)]
   ├─ Reads `backend/email-machinery/app/policy.md` (Lumen & Lode bespoke jewellery component rate card)
   ├─ Inspects attached sketches/mock-ups (`image.png`) with Gemini structured output (`InvoiceDraft`)
   ├─ Decides: `clarify` | `answer` | `decline` | `invoice`
   ▼
[2. Cognee Shared Customer & Contract Memory Graph (`frontend/src/memory-ledger.ts`)]
   ├─ Recalls customer profile, contracted rate cards, & historical dispute/goodwill credits
   ├─ e.g., Lady Eleanor Vance's 10% goodwill discount from Oct 10 clasp delay
   ▼
[3. Deterministic Policy & Safety Engine (`frontend/src/policy.ts` + `policy.md`)]
   ├─ POL-LIMIT-001: Auto-finalize <= £10,000.00; hold > £10,000.00 as Stripe `DRAFT`
   ├─ POL-DISC-002 : Max 15% autonomous discount & never below raw materials floor
   ├─ POL-DUP-003  : Idempotent trigger & Resend `email_id` deduplication
   ├─ POL-RATE-004 : Exact component rate card match against `policy.md`
   ├─ Safety Shield : Declines weapon replicas ("What we don't make") & prompt-injection overrides
   ▼
[4. Stripe Test Mode + Resend PDF Reply (`frontend/src/stripe-client.ts` & `backend/email-machinery/app/main.py`)]
   └─ Creates Customer -> Invoice -> InvoiceItems -> Finalizes (or holds `DRAFT`), attaches Stripe PDF, and emails customer & team via Resend
```

## Quick Start

Run the 17-test verification suite:

```bash
npm test
```

Run the 4-Act Guided Demo in the terminal (includes Matthew's live Resend + Gemini `clarify` thread from `backend/email-machinery/server.log` followed by all 4 judging acts):

```bash
npm run demo
```

Launch the interactive Unified Command Center Dashboard (`http://localhost:3000`):

```bash
npm start
```

 Run the FastAPI Resend + Gemini Webhook Service (`backend/email-machinery`):

```bash
cd backend/email-machinery
uv run uvicorn app.main:app --reload --port 8000
```
