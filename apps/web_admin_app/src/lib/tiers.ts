export const TIERS = [
  {
    id:             "free",
    name:           "Free",
    maxCompetitors: 20,
    range:          "Up to 20 competitors",
    description:    "Perfect for small local events and club training sessions.",
  },
  {
    id:             "starter",
    name:           "Starter",
    maxCompetitors: 50,
    range:          "21–50 competitors",
    description:    "For growing clubs hosting inter-club and regional events.",
  },
  {
    id:             "club",
    name:           "Club",
    maxCompetitors: 100,
    range:          "51–100 competitors",
    description:    "For established clubs running state-level tournaments.",
  },
  {
    id:             "regional",
    name:           "Regional",
    maxCompetitors: 200,
    range:          "101–200 competitors",
    description:    "For large regional championships and national qualifiers.",
  },
  {
    id:             "elite",
    name:           "Elite",
    maxCompetitors: Infinity,
    range:          "200+ competitors",
    description:    "For national federations and major championship events.",
  },
] as const;

export type TierId = typeof TIERS[number]["id"];
