import type { PricingMap } from "../types.js";
import type { FetchFn } from "./types.js";
/** Minimal subset of OpenRouter model info used for pricing + limits. */
export type OpenRouterModelInfo = {
    id: string;
    context_length?: number;
    pricing?: {
        prompt?: number;
        completion?: number;
    };
};
/**
 * Fetches the OpenRouter model catalog (cached in-memory per `apiKey`).
 *
 * Note: OpenRouter pricing values are USD per 1M tokens.
 */
export declare function fetchOpenRouterModelCatalog({ apiKey, fetchImpl, ttlMs, }: {
    apiKey: string;
    fetchImpl: FetchFn;
    ttlMs?: number;
}): Promise<OpenRouterModelInfo[]>;
/**
 * Converts OpenRouter's catalog pricing to a `PricingMap`.
 *
 * Entries without pricing are skipped.
 */
export declare function openRouterPricingMapFromCatalog(catalog: OpenRouterModelInfo[]): PricingMap;
/**
 * Convenience wrapper: fetch catalog → convert to pricing map.
 *
 * Uses the same in-memory TTL as `fetchOpenRouterModelCatalog()`.
 */
export declare function fetchOpenRouterPricingMap({ apiKey, fetchImpl, ttlMs, }: {
    apiKey: string;
    fetchImpl: FetchFn;
    ttlMs?: number;
}): Promise<PricingMap>;
//# sourceMappingURL=openrouter.d.ts.map