import ms from "ms";

export const WOWHEAD_BASE_URL = "https://www.wowhead.com";
export const QUERY_PERSIST_KEY = "wowhead-query-v4";
export const SEARCH_CACHE_VERSION = "v4";
export const CACHE_MAX_AGE_MS = ms("12h");
export const SEARCH_DEBOUNCE_FALLBACK_TEXT = "Search retail Wowhead...";

export const ENTITY_TYPES = [
  { value: "all", title: "All" },
  { value: "item", title: "Items" },
  { value: "npc", title: "NPCs" },
  { value: "quest", title: "Quests" },
  { value: "spell", title: "Spells" },
  { value: "achievement", title: "Achievements" },
  { value: "object", title: "Objects" },
  { value: "zone", title: "Zones" },
  { value: "faction", title: "Factions" },
  { value: "currency", title: "Currencies" },
  { value: "recipe", title: "Recipes" },
  { value: "guide", title: "Guides" },
] as const;
