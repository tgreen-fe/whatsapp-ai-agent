import OpenAI from "openai";

const SYSTEM_PROMPT = [
  "You are a concise and helpful WhatsApp assistant with live web access.",
  "Use the web_search tool whenever a question needs current, factual, local,",
  "or post-training information; otherwise answer directly.",
  "Keep replies short enough for WhatsApp."
].join(" ");

// Keep gpt-5.4-mini: it is fast, cheap, and supports the Responses API web_search tool.
const DEFAULT_MODEL = "gpt-5.4-mini";
const MAX_SOURCES = 3;

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

// Pull the assistant text and any cited sources out of a Responses API result.
// Exported so it can be unit-tested without a live API call.
export function buildReplyFromResponse(response) {
  const text = (response?.output_text || "").trim();

  const output = Array.isArray(response?.output) ? response.output : [];
  // The model only emits a web_search_call item when it actually searched.
  const searched = output.some((item) => item?.type === "web_search_call");

  const sources = [];
  const seen = new Set();

  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const part of item.content) {
      const annotations = Array.isArray(part?.annotations) ? part.annotations : [];

      for (const annotation of annotations) {
        if (annotation?.type !== "url_citation") {
          continue;
        }

        // Responses API uses a flat shape ({ url, title }); handle the legacy
        // Chat Completions nested shape ({ url_citation: { url, title } }) too.
        const url = annotation.url || annotation.url_citation?.url;
        const title = annotation.title || annotation.url_citation?.title || "";

        if (!url || seen.has(url)) {
          continue;
        }

        seen.add(url);
        sources.push({ url, title });
      }
    }
  }

  return { text, searched, sources };
}

// Compact citations: only attach sources when the model actually searched.
export function formatReply({ text, searched, sources }) {
  const body = text || "I could not generate a response right now. Please try again.";

  if (!searched || !Array.isArray(sources) || sources.length === 0) {
    return body;
  }

  const links = sources.slice(0, MAX_SOURCES).map((source) => source.url);

  return `${body}\n\nSources:\n${links.join("\n")}`;
}

export async function runAgent({ userId, userMessage }) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();

  if (!apiKey) {
    return "Server config error: OPENAI_API_KEY is missing.";
  }

  const text = (userMessage || "").trim();
  if (!text) {
    return "Please send a text message and I'll help — I can also look things up on the web.";
  }

  const client = new OpenAI({ apiKey });

  const history = getHistory(userId);

  let response;

  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: [...history, { role: "user", content: text }],
      tools: [{ type: "web_search" }]
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
      return `Server config error: OPENAI_MODEL '${model}' is not available, or it does not support web_search.`;
    }

    return "AI service error. Please try again in a moment.";
  }

  const parsed = buildReplyFromResponse(response);
  const finalReply = formatReply(parsed);

  // Persist the clean assistant text (without appended links) as conversation context.
  pushToHistory(userId, { role: "user", content: text });
  pushToHistory(userId, { role: "assistant", content: parsed.text || finalReply });

  return finalReply;
}
