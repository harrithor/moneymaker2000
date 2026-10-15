import fs from 'node:fs';
import path from 'node:path';

export interface LumenLineItem {
  description: string;
  quantity: number;
  unit_amount_cents: number;
}

export interface LumenInvoiceDraft {
  reasoning: string;
  decision: 'invoice' | 'clarify' | 'decline' | 'answer';
  message_to_customer: string;
  customer_name: string;
  customer_email: string;
  currency: string;
  line_items: LumenLineItem[];
  summary: string;
}

export interface LumenFaqEntry {
  question: string;
  answer: string;
}

export interface BackendLiveEmailEvent {
  eventId: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  attachmentFilename?: string;
  decision: 'invoice' | 'clarify' | 'decline' | 'answer';
  reasoning: string;
  messageToCustomer: string;
  resendReplyId?: string;
}

const BACKEND_DIR = path.resolve(import.meta.dirname, '../../backend/email-machinery');
const POLICY_MD_PATH = path.join(BACKEND_DIR, 'app/policy.md');
const SERVER_LOG_PATH = path.join(BACKEND_DIR, 'server.log');

export function loadLumenPolicyMarkdown(): string {
  if (fs.existsSync(POLICY_MD_PATH)) {
    return fs.readFileSync(POLICY_MD_PATH, 'utf8');
  }
  return '# Lumen & Lode — custom jewellery pricing and policy\nAll prices in GBP.';
}

export function buildLumenFaqFromPolicy(policyMd = loadLumenPolicyMarkdown()): LumenFaqEntry[] {
  const hasZeroPriceNote = policyMd.includes('Custom jewellery — £0');
  return [
    {
      question: 'Why does the website list "Custom jewellery — £0"?',
      answer: hasZeroPriceNote
        ? 'Every bespoke piece at Lumen & Lode is priced individually in GBP from the brief and sketch mock-up agreed between you and our jeweller, itemised line-by-line for metal, stones, findings, and labour.'
        : 'Every piece is priced individually from your brief.',
    },
    {
      question: 'Which precious metals do you work with and how are they priced?',
      answer:
        'We price metals per gram of the finished piece: Sterling silver (£4/g), Titanium (£6/g), Gold vermeil (£9/g), 9ct gold (£45/g), Palladium 950 (£55/g), 14ct gold (£65/g), Platinum 950 (£70/g), and 18ct gold (£95/g). Typical weights when unstated are 4g for a ring, 8g for a signet ring, and 3g for a pendant or pair of earrings.',
    },
    {
      question: 'How are diamonds, gemstones, and chains priced?',
      answer:
        'Stones are priced per carat: Lab-grown diamond G–H VS (£600/ct), Natural diamond G–H VS (£4,000/ct), Natural diamond D–F VVS (£7,500/ct), Moissanite (£250/ct), Sapphire (£900/ct), Emerald (£1,200/ct), Ruby (£1,500/ct), Aquamarine (£300/ct), Amethyst/Citrine/Topaz (£60/ct), and Pavé accent diamonds ≤0.02ct (£30 each). 45 cm chains are £30 (silver), £220 (9ct gold), £480 (platinum), or £520 (18ct gold).',
    },
    {
      question: 'What are your labour, stone setting, and minimum order charges?',
      answer:
        'Design and CAD from your brief or mock-up is £150 per piece. Making is £60/hour (2h simple band, 3h signet or pendant, 4h solitaire ring or earrings, 5h bracelet, 7h halo/pavé ring). Stone setting is £40 per main stone and £10 per pavé stone. Engraving is £35 (£120 hand-engraved signet), rhodium plating is £30, and our minimum order is £250.',
    },
    {
      question: 'What are your payment terms, turnaround times, and rush options?',
      answer:
        'Invoices are payable within 30 days via Stripe, and making begins once paid. Standard turnaround is 4–6 weeks from payment. Rush orders under 2 weeks add +25% on labour.',
    },
    {
      question: 'What is your policy on refunds, faults, and ring resizing?',
      answer:
        'Bespoke pieces are non-refundable once making starts, but we repair any manufacturing fault free of charge and offer complimentary resizing within 60 days of delivery.',
    },
    {
      question: 'Is there anything Lumen & Lode will decline to make?',
      answer:
        'Yes. Per our policy, we decline requests for weapons or weapon replicas (including as charms), political symbols or slogans, hate symbols, sexually explicit designs, drug imagery, or copies of other brands’ logos and trademarked designs.',
    },
  ];
}

export function parseBackendServerLogEvents(): BackendLiveEmailEvent[] {
  if (!fs.existsSync(SERVER_LOG_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(SERVER_LOG_PATH, 'utf8');
  const events: BackendLiveEmailEvent[] = [];

  const draftRegex =
    /INFO:invoice-agent:Email from ([^\s:]+):\s*([^\n(]+)\s*\(reply-all:[\s\S]*?INFO:invoice-agent:Draft:\s*(\{[\s\S]*?\n\})\nINFO:invoice-agent:Replied\s+([^\s]+)\s+to/g;

  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = draftRegex.exec(raw)) !== null) {
    const senderEmail = match[1].trim();
    const subject = match[2].trim();
    const draftJson = match[3];
    const resendReplyId = match[4].trim();
    try {
      const parsed = JSON.parse(draftJson) as LumenInvoiceDraft;
      events.push({
        eventId: `resend_live_${index}`,
        subject,
        customerName: parsed.customer_name || senderEmail,
        customerEmail: parsed.customer_email || senderEmail,
        attachmentFilename: index === 1 ? 'image.png (East-West Marquise Pendant Mock-up)' : undefined,
        decision: parsed.decision,
        reasoning: parsed.reasoning,
        messageToCustomer: parsed.message_to_customer,
        resendReplyId,
      });
      index += 1;
    } catch {
      // ignore malformed log block
    }
  }

  return events;
}
