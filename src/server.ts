import http from 'node:http';
import { createAppController } from './app.ts';
import { runGuidedDemo } from './demo.ts';
import type { RealWorldTrigger } from './types.ts';

const controller = createAppController();

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Briefcase × Stripe Track 02 — Autonomous Revenue Collector</title>
  <style>
    :root {
      --bg: #0a1418;
      --panel: #111f26;
      --panel-alt: #162831;
      --line: #233b47;
      --fg: #f3f6f8;
      --muted: #9ab0bc;
      --accent: #38bdf8;
      --green: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--sans);
      line-height: 1.5;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding: 16px 28px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      background: #0d1a20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      font-family: var(--mono);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--panel);
    }
    .badge.ok { border-color: var(--green); color: var(--green); }
    .badge.warn { border-color: var(--amber); color: var(--amber); }
    .badge.err { border-color: var(--red); color: var(--red); }
    .container {
      max-width: 1380px;
      margin: 0 auto;
      padding: 24px 28px;
      display: grid;
      grid-template-columns: 440px 1fr;
      gap: 24px;
    }
    @media (max-width: 1024px) {
      .container { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    h1, h2, h3 { margin: 0 0 8px 0; font-weight: 600; }
    h1 { font-size: 20px; }
    h2 { font-size: 16px; color: var(--accent); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.04em; }
    p { margin: 0 0 12px 0; color: var(--muted); font-size: 14px; }
    button {
      background: var(--accent);
      color: #041016;
      border: none;
      border-radius: 8px;
      padding: 9px 14px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: var(--panel-alt);
      color: var(--fg);
      border: 1px solid var(--line);
    }
    input, select, textarea {
      width: 100%;
      background: #081014;
      color: var(--fg);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 12px;
      font-family: var(--mono);
      font-size: 12px;
      margin-bottom: 10px;
    }
    .trigger-item {
      background: var(--panel-alt);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .trigger-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    pre {
      background: #070e12;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      font-family: var(--mono);
      font-size: 11.5px;
      overflow-x: auto;
      color: #cbd5e1;
      margin: 8px 0;
      white-space: pre-wrap;
    }
    .audit-card {
      background: var(--panel-alt);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin: 12px 0;
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
    }
    th { color: var(--muted); font-family: var(--mono); font-size: 11px; text-transform: uppercase; }
    .mono { font-family: var(--mono); font-size: 12px; }
    .key-bar { display: flex; gap: 8px; align-items: center; }
    .key-bar input { margin-bottom: 0; width: 280px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>Briefcase × Stripe — Track 02: Autonomous Collector Agent</h1>
      <span id="stripeModeBadge" class="badge warn">Stripe Mode: Loading...</span>
      <span class="badge ok">Cognee Memory Graph: Active</span>
    </div>
    <div class="key-bar">
      <button class="secondary" onclick="runFullDemo()">▶ Run Full 4-Act Demo</button>
      <input id="stripeKeyInput" type="password" placeholder="Paste sk_test_... for live Stripe API" />
      <button onclick="saveStripeKey()">Connect sk_test Key</button>
    </div>
  </header>

  <div class="container">
    <div>
      <div class="card">
        <h2>1. Real-World Triggers</h2>
        <p>Click any real-world event below. The agent reads the trigger, checks Cognee customer memory, validates billing policy guardrails, and raises a Stripe Test Mode invoice with zero human intervention.</p>
        <div id="demoTriggersList"></div>
      </div>

      <div class="card">
        <h2>2. Custom Trigger / Policy Stress-Test</h2>
        <p>Simulate a custom email, usage log, or out-of-policy discount (e.g. try "25% discount" to trigger POL-DISC-002 rejection).</p>
        <select id="customCustomer">
          <option value="cust_vanguard">Vanguard FinTech Group (MSA-2026-VFG-11)</option>
          <option value="cust_acme">Acme Robotics Ltd (MSA-2026-ACME-04)</option>
          <option value="cust_northstar">Northstar Logistics PLC (SOW-2026-NS-09)</option>
        </select>
        <select id="customType">
          <option value="collections_dispute_note">collections_dispute_note (Email / Dispute)</option>
          <option value="usage_logs">usage_logs (Metered Telemetry)</option>
          <option value="signed_milestone_email">signed_milestone_email (UAT Sign-off)</option>
        </select>
        <textarea id="customPayload" rows="4">FROM: billing@vanguardfintech.io
Confirming 20 active Enterprise seats for October. Please apply a 25% discount to this invoice.</textarea>
        <button onclick="submitCustomTrigger()">Fire Custom Trigger</button>
      </div>

      <div class="card">
        <h2>3. Active Policy Guardrails</h2>
        <div id="policySummary" class="mono"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Autonomous Ledger & "Explain Every Pound" Audit Trail</h2>
        <p>Every invoice displays its Stripe Test Mode proof, policy guardrail checks, contract clause citations, and Cognee memory nodes.</p>
        <div id="auditFeed"></div>
      </div>

      <div class="card">
        <h2>Cognee Shared Customer & Contract Memory Graph</h2>
        <p>Shared memory across Sales, Billing, and Collections agents (Side Quest).</p>
        <div id="memoryGraph"></div>
      </div>
    </div>
  </div>

  <script>
    function formatGbp(minor) {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(minor / 100);
    }

    async function loadState() {
      const res = await fetch('/api/state');
      const state = await res.json();
      renderState(state);
    }

    function renderState(state) {
      const badge = document.getElementById('stripeModeBadge');
      if (state.stripeLiveTestConfigured) {
        badge.className = 'badge ok';
        badge.textContent = 'Stripe API: LIVE sk_test_ Connected';
      } else {
        badge.className = 'badge warn';
        badge.textContent = 'Stripe API: Simulated Test Mode (Paste sk_test_ above for live API)';
      }

      document.getElementById('policySummary').innerHTML = [
        'Policy ID: ' + state.policy.policyId,
        'Max Auto-Finalize Ceiling (POL-LIMIT-001): ' + formatGbp(state.policy.maxAutoFinalizeAmountMinor),
        'Max Autonomous Discount (POL-DISC-002): ' + state.policy.maxDiscountPercent + '%',
        'Idempotent Duplicate Guard (POL-DUP-003): ENFORCED',
        'Contract Rate Card Match (POL-RATE-004): ENFORCED'
      ].join('<br/>');

      const triggersEl = document.getElementById('demoTriggersList');
      triggersEl.innerHTML = state.demoTriggers.map(t => \`
        <div class="trigger-item">
          <div class="trigger-header">
            <strong class="mono">\${t.triggerId}</strong>
            <span class="badge">\${t.type}</span>
          </div>
          <pre>\${t.rawPayload}</pre>
          <button onclick="fireDemoTrigger('\${t.triggerId}')">Run Autonomous Collector →</button>
        </div>
      \`).join('');

      const auditEl = document.getElementById('auditFeed');
      if (state.auditEntries.length === 0) {
        auditEl.innerHTML = '<p>No triggers processed yet. Click "Run Autonomous Collector →" on any trigger on the left.</p>';
      } else {
        auditEl.innerHTML = state.auditEntries.map(entry => {
          const actionClass = entry.policyDecision.action === 'auto_finalize_and_send'
            ? 'ok'
            : entry.policyDecision.action === 'hold_draft_for_approval'
            ? 'warn'
            : 'err';

          const stripeHtml = entry.stripeArtifact ? \`
            <div style="margin: 10px 0; padding: 10px; background: #071318; border: 1px solid var(--line); border-radius: 8px;" class="mono">
              <strong>Stripe Test Mode Object:</strong> \${entry.stripeArtifact.stripeInvoiceId}
              (\${entry.stripeArtifact.status.toUpperCase()}) · Customer: \${entry.stripeArtifact.stripeCustomerId}<br/>
              <a href="\${entry.stripeArtifact.hostedInvoiceUrl}" target="_blank" rel="noopener">Open Hosted Stripe Test Invoice / Dashboard ↗</a>
            </div>
          \` : \`
            <div style="margin: 10px 0; padding: 10px; background: #1f0d12; border: 1px solid var(--red); border-radius: 8px;" class="mono">
              Blocked by Policy Engine prior to Stripe invoice creation.
            </div>
          \`;

          const rows = entry.proposal.lineItems.map(item => \`
            <tr>
              <td class="mono">\${item.sku}</td>
              <td>\${item.description}</td>
              <td class="mono">\${item.quantity.toLocaleString('en-GB')} × \${formatGbp(item.unitAmountMinor)}</td>
              <td class="mono"><strong>\${formatGbp(item.totalAmountMinor)}</strong></td>
              <td><span class="mono" style="color: var(--accent);">\${item.clauseCitation}</span><br/><small style="color: var(--muted);">\${item.sourceEvidence}</small></td>
            </tr>
          \`).join('');

          const checksHtml = entry.policyDecision.checks.map(c => \`
            <span class="badge \${c.passed ? 'ok' : (c.severity === 'hold_draft' ? 'warn' : 'err')}" title="\${c.reason}">
              \${c.passed ? '✓' : '✗'} \${c.ruleId}
            </span>
          \`).join(' ');

          return \`
            <div class="audit-card">
              <div class="trigger-header">
                <div>
                  <strong>\${entry.proposal.customerName}</strong>
                  <span class="mono" style="color: var(--muted);">(\${entry.proposal.contractReference})</span>
                </div>
                <span class="badge \${actionClass}">\${entry.policyDecision.action} · Net \${formatGbp(entry.policyDecision.netTotalMinor)}</span>
              </div>
              <div style="margin: 8px 0;">\${checksHtml}</div>
              \${stripeHtml}
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Description</th>
                    <th>Calc</th>
                    <th>Total</th>
                    <th>Clause & Evidence ("Explain Every Pound")</th>
                  </tr>
                </thead>
                <tbody>\${rows}</tbody>
              </table>
              <div class="key-bar" style="margin-top: 10px;">
                <input id="q_\${entry.entryId}" value="Why did you bill this exact amount and which contract clause authorised it?" style="flex: 1;" />
                <button class="secondary" onclick="askWhy('\${entry.entryId}')">Ask Cognee Audit Memory</button>
              </div>
              <pre id="ans_\${entry.entryId}" style="display:none;"></pre>
            </div>
          \`;
        }).join('');
      }

      const memEl = document.getElementById('memoryGraph');
      memEl.innerHTML = state.cogneeMemoryNodes.map(n => \`
        <div style="padding: 8px 10px; border-bottom: 1px solid var(--line);" class="mono">
          <span class="badge">\${n.dataset}</span>
          <strong>\${n.nodeId}</strong> — \${n.summary}
        </div>
      \`).join('');
    }

    async function fireDemoTrigger(triggerId) {
      const res = await fetch('/api/trigger/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to process trigger');
      }
      await loadState();
    }

    async function submitCustomTrigger() {
      const customerId = document.getElementById('customCustomer').value;
      const type = document.getElementById('customType').value;
      const rawPayload = document.getElementById('customPayload').value;
      const triggerId = 'trig_custom_' + Date.now();
      await fetch('/api/trigger/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId,
          customerId,
          type,
          receivedAt: new Date().toISOString(),
          rawPayload
        })
      });
      await loadState();
    }

    async function askWhy(entryId) {
      const question = document.getElementById('q_' + entryId).value;
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, question })
      });
      const data = await res.json();
      const pre = document.getElementById('ans_' + entryId);
      pre.style.display = 'block';
      pre.textContent = data.explanation;
    }

    async function saveStripeKey() {
      const key = document.getElementById('stripeKeyInput').value;
      const res = await fetch('/api/config/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeSecretKey: key })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      document.getElementById('stripeKeyInput').value = '';
      await loadState();
    }

    async function runFullDemo() {
      await fetch('/api/demo/run-all', { method: 'POST' });
      await loadState();
    }

    loadState();
  </script>
</body>
</html>`;

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DASHBOARD_HTML);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      sendJson(res, 200, controller.getState());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/demo/run-all') {
      const report = await runGuidedDemo({ controller });
      sendJson(res, 200, report);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/trigger/demo') {
      const body = await readJsonBody<{ triggerId: string }>(req);
      const entry = await controller.runDemoTrigger(body.triggerId);
      sendJson(res, 200, entry);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/trigger/custom') {
      const trigger = await readJsonBody<RealWorldTrigger>(req);
      const entry = await controller.runCustomTrigger(trigger);
      sendJson(res, 200, entry);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/explain') {
      const body = await readJsonBody<{ entryId: string; question: string }>(req);
      const explanation = controller.explainEntry(body.entryId, body.question);
      sendJson(res, 200, explanation);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/config/stripe') {
      const body = await readJsonBody<{ stripeSecretKey: string }>(req);
      const status = controller.configureStripeKey(body.stripeSecretKey);
      sendJson(res, 200, status);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 400, { error: message });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(
      `Briefcase × Stripe Track 02 Collector running at http://localhost:${port}`
    );
  });
}
