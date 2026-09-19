// Ollama local AI gateway — streams text from a local Ollama instance.
// Uses the /api/generate endpoint for streaming responses.

const OLLAMA_URL = process.env["OLLAMA_URL"] || "http://localhost:11434";
const OLLAMA_MODEL = process.env["OLLAMA_MODEL"] || "qwen2.5:3b";

export async function streamOllamaText(
  input: string,
  opts: { instructions?: string } = {},
): Promise<Response> {
  try {
    // Build the prompt with system instructions
    const fullPrompt = opts.instructions
      ? `${opts.instructions}\n\nUser question: ${input}`
      : input;

    // Call Ollama API with streaming
    const upstream = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.3,
          num_predict: 1024,
        },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response(
        `Ollama request failed (${upstream.status}). ${detail.slice(0, 300)}`,
        { status: upstream.status || 502 },
      );
    }

    const body = upstream.body;
    const encoder = new TextEncoder();

    // Re-emit only the response text deltas as a plain text stream
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const evt = JSON.parse(line) as {
                  response?: string;
                  done?: boolean;
                };
                if (evt.response) {
                  controller.enqueue(encoder.encode(evt.response));
                }
              } catch {
                // ignore partial frames
              }
            }
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `Ollama connection failed: ${message}. Make sure Ollama is running (ollama serve).`,
      { status: 503 },
    );
  }
}
