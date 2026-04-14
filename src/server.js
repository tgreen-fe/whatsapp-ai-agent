import "dotenv/config";
import express from "express";
import twilio from "twilio";
import { runAgent } from "./agent.js";

const app = express();
const port = Number(process.env.PORT || 3000);

// Twilio sends webhook payload as x-www-form-urlencoded.
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/webhook/whatsapp", (_req, res) => {
  res.status(200).send("Webhook is live. This endpoint expects POST requests from Twilio.");
});

app.post("/webhook/whatsapp", async (req, res) => {
  const incomingBody = req.body.Body || "";
  const from = req.body.From || "unknown";
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const reply = await runAgent({ userId: from, userMessage: incomingBody });
    twiml.message(reply);
  } catch (error) {
    console.error("Webhook error", error);
    twiml.message("Server error. Please try again in a moment.");
  }

  res.type("text/xml").send(twiml.toString());
});

app.listen(port, () => {
  console.log(`WhatsApp AI agent listening on port ${port}`);
});
