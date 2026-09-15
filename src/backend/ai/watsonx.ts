// IBM watsonx.ai gateway — streams text from the watsonx.ai text generation API.
// Uses the OpenAI-compatible chat completions endpoint for streaming.

const WATSONX_URL = process.env["WATSONX_URL"] || "https://eu-de.ml.cloud.ibm.com";
const WATSONX_MODEL = process.env["WATSONX_MODEL_ID"] || process.env["WATSONX_MODEL"] || "ibm/granite-4-h-small";
const WATSONX_API_VERSION = process.env["WATSONX_API_VERSION"] || "2025-10-25";

// In-memory IAM token cache — IBM tokens are valid for ~1 hour; refresh 5 min early.
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const apiKey = process.env["WATSONX_APIKEY"] || process.env["WATSONX_API_KEY"];
  if (!apiKey) throw new Error("WATSONX_APIKEY or WATSONX_API_KEY is not set");

  const tokenUrl = "https://iam.cloud.ibm.com/identity/token";
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`watsonx.ai token request failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { access_token: string };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // expire cache 5 min before token dies
  return cachedToken;
}

export async function streamGatewayText(
  input: string,
  opts: { instructions?: string } = {},
): Promise<Response> {
  const projectId = process.env["WATSONX_PROJECT_ID"];
  const apiKey = process.env["WATSONX_APIKEY"] || process.env["WATSONX_API_KEY"];

  if (!apiKey || !projectId) {
    return new Response(
      "AI is not configured. Set WATSONX_APIKEY and WATSONX_PROJECT_ID environment variables.",
      { status: 500 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Failed to authenticate with watsonx.ai: ${message}`, { status: 501 });
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.instructions) {
    messages.push({ role: "system", content: opts.instructions });
  }
  messages.push({ role: "user", content: input });

  const upstream = await fetch(
    `${WATSONX_URL}/ml/v1/text/chat_stream?version=${WATSONX_API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model_id: WATSONX_MODEL,
        project_id: projectId,
        messages,
        stream: true,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      `watsonx.ai request failed (${upstream.status}). ${detail.slice(0, 300)}`,
      { status: upstream.status || 502 },
    );
  }

  const body = upstream.body;
  const encoder = new TextEncoder();

  // Re-emit only the answer text deltas as a plain text stream.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let emitted = false;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
                results?: Array<{ generated_text?: string }>;
              };
              const delta = evt.choices?.[0]?.delta?.content;
              const text = evt.results?.[0]?.generated_text;
              if (delta) {
                emitted = true;
                controller.enqueue(encoder.encode(delta));
              } else if (text && !emitted) {
                emitted = true;
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // ignore keep-alives and partial frames
            }
          }
        }
        if (!emitted) {
          controller.enqueue(encoder.encode("The assistant returned no text. Please try again."));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[The AI response was interrupted.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
