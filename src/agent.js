import OpenAI from "openai";

const SYSTEM_PROMPT = [
  "You are a concise and helpful WhatsApp assistant.",
  "Keep replies short enough for WhatsApp."
].join(" ");

const memory = new Map();

function getHistory(userId) {
  if (!memory.has(userId)) {
    memory.set(userId, []);
  }

  return memory.get(userId);
}

function pushToHistory(userId, message) {
  const history = getHistory(userId);
  history.push(message);

  // Keep only the latest turns so token usage stays reasonable.
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

function normalizeAssistantText(content) {
  if (!content) {
    return "I could not generate a response right now. Please try again.";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  return "I could not generate a response right now. Please try again.";
}

export async function runAgent({ userId, userMessage }) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();

  if (!apiKey) {
    return "Server config error: OPENAI_API_KEY is missing.";
  }

  const client = new OpenAI({ apiKey });

  const history = getHistory(userId);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage }
  ];

  let completion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.3
    });
  } catch (error) {
    const status = error?.status;
    const message = error?.message || "";
    console.error("OpenAI request failed", { status, message });

    if (status === 401) {
      return "Server config error: OPENAI_API_KEY is invalid.";
    }

    if (status === 429) {
      return "OpenAI quota exceeded. Please add billing/credits, then try again.";
    }

    if (status === 404 || /model/i.test(message)) {
      return `Server config error: OPENAI_MODEL '${model}' is not available.`;
    }

    return "AI service error. Please try again in a moment.";
  }

  const assistantMessage = completion.choices?.[0]?.message;

  if (!assistantMessage) {
    return "I could not process that. Please try again.";
  }

  const finalReply = normalizeAssistantText(assistantMessage.content);
  pushToHistory(userId, { role: "user", content: userMessage });
  pushToHistory(userId, { role: "assistant", content: finalReply });

  return finalReply;
}
