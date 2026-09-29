// Single source of truth for per-tournament competitor capacity tiers.
// Prices and Stripe Price IDs will be wired in Phase 3. For now, priceUsd is
// the canonical price; stripePriceId is a placeholder for future use.

export interface PricingTier {
  id: string;
  name: string;
  maxCompetitors: number;
  priceUsd: number;
  description: string;
  stripePriceId: string | null;
  popular?: boolean;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id:             "free",
    name:           "Free",
    maxCompetitors: 10,
    priceUsd:       0,
    description:    "Perfect for small local events.",
    stripePriceId:  null,
  },
  {
    id:             "tier_50",
    name:           "Starter",
    maxCompetitors: 50,
    priceUsd:       49,
    description:    "For inter-club and regional events.",
    stripePriceId:  "price_1UL5UN2D2WtSzc466UIbfeAq",
  },
  {
    id:             "tier_100",
    name:           "Club",
    maxCompetitors: 100,
    priceUsd:       125,
    description:    "For state-level tournaments.",
    stripePriceId:  "price_1UL5V62D2WtSzc46ewjzQaYC",
    popular:        true,
  },
  {
    id:             "tier_250",
    name:           "Regional",
    maxCompetitors: 250,
    priceUsd:       250,
    description:    "For large regional championships.",
    stripePriceId:  "price_1UL5VY2D2WtSzc46TjEbsCqR",
  },
  {
    id:             "tier_500",
    name:           "National",
    maxCompetitors: 500,
    priceUsd:       450,
    description:    "For national federations and major events.",
    stripePriceId:  "price_1UL5WN2D2WtSzc46K8FhMeo8",
  },
] as const;

export type PricingTierId = typeof PRICING_TIERS[number]["id"];

export function getPricingTier(id: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}

/** Format a USD price for display. $0 = "Free". */
export function formatTierPrice(priceUsd: number): string {
  if (priceUsd === 0) return "Free";
  return `$${priceUsd}`;
}
