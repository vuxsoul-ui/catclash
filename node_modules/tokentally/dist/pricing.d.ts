import type { Pricing, PricingMap } from "./types.js";
/**
 * Convenience helper for pricing tables that publish USD per 1M tokens.
 *
 * Example: input $1.75 / 1M, output $14.00 / 1M.
 */
export declare function pricingFromUsdPerMillion({ inputUsdPerMillion, outputUsdPerMillion, }: {
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
}): Pricing;
/**
 * Creates a `Pricing` instance from USD-per-token values.
 *
 * Use this when you already have per-token pricing (rather than per-million).
 */
export declare function pricingFromUsdPerToken({ inputUsdPerToken, outputUsdPerToken, }: {
    inputUsdPerToken: number;
    outputUsdPerToken: number;
}): Pricing;
/**
 * Resolves pricing from a map, trying common key variants.
 *
 * Example: if you pass `openai/gpt-5.2`, it will also try `gpt-5.2`.
 */
export declare function resolvePricingFromMap(map: PricingMap, modelId: string): Pricing | null;
//# sourceMappingURL=pricing.d.ts.map