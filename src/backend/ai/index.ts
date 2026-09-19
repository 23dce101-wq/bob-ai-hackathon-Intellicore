// Unified AI gateway — tries Ollama first, falls back to WatsonX.
// Whichever backend is available gets used.

import { streamOllamaText } from "./ollama.js";
import { streamGatewayText } from "./watsonx.js";

export async function streamText(
  input: string,
  opts: { instructions?: string } = {},
): Promise<Response> {
  // Try Ollama first (local, fast, no API key needed)
  try {
    const resp = await streamOllamaText(input, opts);
    // If Ollama returned a successful stream, use it
    if (resp.ok) return resp;
    // If Ollama failed (503 = not running), fall through to WatsonX
    console.warn(`Ollama returned ${resp.status}, trying WatsonX...`);
  } catch (err) {
    console.warn("Ollama unavailable, trying WatsonX...", err);
  }

  // Fall back to WatsonX
  try {
    const resp = await streamGatewayText(input, opts);
    return resp;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      `No AI backend available. Ollama is not running and WatsonX failed: ${msg}`,
      { status: 503 },
    );
  }
}
