# Demo: Lumen & Lode custom jewellery agent

Lumen & Lode sells custom jewellery listed at £0 on its website. The real price is agreed over email
between the customer and the jeweller, from a written brief and a mock-up image. The agent reads the
thread, applies the shop policy (`app/policy.md`) and either answers questions or creates a Stripe
invoice.

| Inbox | What it does |
|---|---|
| `faq@soleapelir.resend.app` | Answers questions from the policy. Never bills. |
| `billing@soleapelir.resend.app` | Prices the agreed piece, creates a Stripe invoice, replies with the PDF and emails the team the reasoning. Declines anything the policy forbids. |

## Before you start

1. Set `NOTIFY_EMAIL` in `.env` to your Resend account email.
2. Start the server: `uv run fastapi dev app/main.py --port 8000`
3. Check ngrok is running and points at port 8000.
4. Send every email from your Resend account email. Resend's shared sender only delivers to that address.
5. Have a mock-up image ready: an oval solitaire on a thin band with small diamonds along it. A sketch or
   an AI-generated image is fine.

## Step 1: questions to the FAQ agent

**To:** `faq@soleapelir.resend.app`

**Subject:**

```
Engagement ring enquiry - Priya Shah
```

**Body:**

```
Hi, can you answer Priya's questions below? Design isn't agreed yet, so please don't invoice.

Matthew
Lumen & Lode

---------- Earlier in this thread ----------

From: Priya Shah <priya.shah@example.com>
To: Matthew (Lumen & Lode)

Thanks Matthew! A few questions before I commit:
1. Your site says custom jewellery is £0. How is the real price worked out?
2. What's the price difference between platinum and 18ct white gold?
3. How much more is a natural diamond than a lab-grown one?
4. How long does it take? I'm proposing in about 5 weeks.
5. Can you resize it if her size is wrong?

Priya

---

From: Matthew (Lumen & Lode)
To: Priya Shah <priya.shah@example.com>

Hi Priya, lovely to hear from you. An oval solitaire is a beautiful choice. We can do platinum or white gold, with a lab-grown or natural diamond. Send me any images you like and I'll sketch something up.

Matthew

---

From: Priya Shah <priya.shah@example.com>
To: Matthew (Lumen & Lode)

Hi! I'm looking for a custom engagement ring for my partner Aisha. Thinking an oval diamond, white metal, maybe some small diamonds on the band. Is that something you do?

Priya
```

**Expected:** a reply answering all five questions from the policy, and no invoice.

- Each piece is priced from the agreed brief.
- Platinum is £70/g; 18ct gold is £95/g.
- A natural diamond is about £4,000/ct; lab-grown is £600/ct.
- Turnaround is 4–6 weeks, so 5 weeks is tight. Rush is under 2 weeks.
- Resizing is free within 60 days.

## Step 2: forward to the billing agent

Forward the agent's reply from step 1, so the whole thread is quoted underneath, to
`billing@soleapelir.resend.app`. **Attach the mock-up image** and paste this at the top:

```
Hi Billing, Priya has signed off. Mock-up attached. Please invoice her at priya.shah@example.com.

Final agreed spec:
- Platinum band
- 1.2ct oval lab-grown diamond (G-H, VS)
- 6 small pavé diamonds along the band, as in the mock-up
- Engraved inside: "P & A 2027"
- Normal turnaround, no rush

Priya's reply: "Perfect, that's exactly it. Let's go ahead!"

Matthew
Lumen & Lode
```

**Expected:**

1. A reply with the Stripe invoice PDF attached and a link to view and pay it online.
2. An "Invoice sent" email to `NOTIFY_EMAIL` with the line items and the agent's reasoning, including
   what it read from the mock-up.
3. The invoice appears at dashboard.stripe.com/test/invoices.

The price is worked out from the policy, so the total should be about **£1,885**:

| Line | Price |
|---|---|
| Platinum, 4 g × £70 | £280 |
| 1.2ct lab-grown diamond × £600/ct | £720 |
| 6 pavé diamonds × £30 | £180 |
| Design and CAD | £150 |
| Making, pavé ring, 7 h × £60 | £420 |
| Setting: 1 main stone × £40 and 6 pavé × £10 | £100 |
| Engraving | £35 |
| **Total** | **£1,885** |

## Optional step 3: the policy refuses a request

Send to `billing@soleapelir.resend.app`:

**Subject:**

```
Re: Engagement ring enquiry - Priya Shah
```

**Body:**

```
Hi Billing, Priya also asked: could we make a small 18ct gold bullet charm for her brother, about 3g? Please invoice if OK.

Matthew
Lumen & Lode
```

**Expected:** a polite refusal under the "no weapons" rule, and no invoice.

## Talking points

- **Why an agent, not a price list:** the price isn't fixed. It comes out of a conversation and a mock-up
  image, so the agent has to read both and apply the policy, for example counting the pavé stones in
  the image.
- **Policy as a file:** prices, materials and the "won't make" list live in `app/policy.md`. The shop
  edits that file, not the code. `GET /faq` turns the same policy into the FAQ for the website.
- **Safety:** the email is treated as information, never as instructions. Prices only come from the
  policy or a price the jeweller confirmed. The FAQ inbox cannot bill anyone. Webhook retries can't
  create the same invoice twice.
- **Audit trail:** every invoice that goes out comes with an email to the team explaining why it costs
  what it does.

## Known limits

- **Reply-all needs a verified domain.** Replies try to go to everyone on the thread, but Resend's
  shared sender only delivers to the account owner. Until a domain is verified, the agent falls back
  to replying only to the sender.
- **The agent only sees one email.** It reads the email that arrives, including any quoted thread in
  it. Attachments from earlier in the thread are only seen if they're attached to that email.
