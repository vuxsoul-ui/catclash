import type { TokenUsageNormalized } from "./types.js";
/**
 * Best-effort normalization of token usage across common provider payloads.
 *
 * Accepts `raw` objects containing any of these fields (examples):
 * - `prompt_tokens`, `completion_tokens`
 * - `input_tokens`, `output_tokens`
 * - `inputTokens`, `outputTokens`, `reasoningTokens`
 *
 * Returns `null` if no recognized token fields are found.
 */
export declare function normalizeTokenUsage(raw: unknown): TokenUsageNormalized | null;
//# sourceMappingURL=usage.d.ts.map