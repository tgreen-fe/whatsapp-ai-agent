# WhatsApp AI Agent

This project lets you message a WhatsApp number and chat with an AI agent that can browse the web.

## What it uses

- Twilio WhatsApp webhook for incoming/outgoing messages
- OpenAI Responses API for agent replies, with the built-in `web_search` tool for live web browsing
- Node.js + Express server

## Web browsing

The agent runs on `gpt-5.4-mini` (set via `OPENAI_MODEL`) using the OpenAI **Responses API** with the
built-in `web_search` tool enabled. The model decides on its own when to search the web for current or
factual information. When it does search, the reply appends up to 3 source links so answers stay
verifiable; ordinary chat replies stay clean with no links.

Any `OPENAI_MODEL` you set must support the `web_search` tool (`gpt-5.4-mini` does). If you point it at a
model without web-search support, the agent will report a config error instead of silently losing browsing.

## 1) Setup

1. Install Node.js 18+.
2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Fill `.env` with real keys:
- `OPENAI_API_KEY`
- `TWILIO_AUTH_TOKEN` (optional in this starter, recommended if you add request signature validation)

## 2) Run the server

```bash
npm run dev
```

The webhook endpoint is:

```text
POST /webhook/whatsapp
```

## 3) Expose local server publicly

Use ngrok (or Cloudflare Tunnel):

```bash
ngrok http 3000
```

Copy the HTTPS URL, for example:

```text
https://abc123.ngrok-free.app
```

Your full Twilio webhook URL will be:

```text
https://abc123.ngrok-free.app/webhook/whatsapp
```

## 4) Configure Twilio WhatsApp

1. In Twilio Console, open your WhatsApp Sandbox (or approved WhatsApp sender).
2. Set "When a message comes in" to your webhook URL.
3. Save.
4. Send a WhatsApp message to your Twilio number.

## Notes

- This starter keeps short in-memory chat history per user phone number.
- For production, add:
  - persistent storage (Redis/Postgres)
  - request signature validation using Twilio signature
  - rate limiting and logging
  - monitoring and retries
