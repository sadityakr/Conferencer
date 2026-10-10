/**
 * Pluggable vision-language model access. Anything that can take a prompt (plus optional
 * images) and return text can be used: a university-hosted model, a commercial API, or a mock.
 */
export interface VlmImage {
  mime: string;
  data: Uint8Array;
}

export interface VlmRequest {
  system?: string;
  prompt: string;
  images?: VlmImage[];
  /** Ask the provider for a JSON object response when it supports that. */
  json?: boolean;
}

export interface VlmProvider {
  readonly name: string;
  complete(req: VlmRequest): Promise<string>;
}

/** Test/offline provider: answers with whatever the responder returns. */
export class MockVlmProvider implements VlmProvider {
  readonly name = "mock";
  readonly calls: VlmRequest[] = [];
  constructor(private responder: (req: VlmRequest) => string | Promise<string> = () => {
    throw new Error("Mock VLM provider has no responder. Set VLM_PROVIDER=openai-compatible to use a real model.");
  }) {}
  async complete(req: VlmRequest): Promise<string> {
    this.calls.push(req);
    return this.responder(req);
  }
}

/** Any server speaking the OpenAI chat-completions protocol (vLLM, Ollama, LM Studio, TGI, ...). */
export class OpenAICompatibleProvider implements VlmProvider {
  readonly name = "openai-compatible";
  constructor(private opts: { baseUrl: string; apiKey?: string; model: string; timeoutMs?: number }) {}

  async complete(req: VlmRequest): Promise<string> {
    const content: unknown[] = [{ type: "text", text: req.prompt }];
    for (const img of req.images ?? []) {
      content.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${Buffer.from(img.data).toString("base64")}` } });
    }
    const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), { role: "user", content }];
    const res = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages,
        temperature: 0,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 180_000),
    });
    if (!res.ok) throw new Error(`VLM request failed: ${res.status} ${await res.text().catch(() => "")}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("VLM response had no message content");
    return text;
  }
}

export function getVlmProvider(env: NodeJS.ProcessEnv = process.env): VlmProvider {
  const kind = env.VLM_PROVIDER ?? "mock";
  if (kind === "openai-compatible") {
    if (!env.VLM_BASE_URL || !env.VLM_MODEL) throw new Error("VLM_BASE_URL and VLM_MODEL must be set for VLM_PROVIDER=openai-compatible");
    return new OpenAICompatibleProvider({ baseUrl: env.VLM_BASE_URL, apiKey: env.VLM_API_KEY, model: env.VLM_MODEL });
  }
  if (kind === "mock") return new MockVlmProvider();
  throw new Error(`Unknown VLM_PROVIDER "${kind}"`);
}
