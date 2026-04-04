import { WOWHEAD_BASE_URL } from "./constants";
import { buildTooltipSvgDataUrl } from "./tooltipSvg";
import type {
  WowheadEntityDetail,
  WowheadEntityType,
  WowheadResult,
} from "./types";

const SEARCH_TIMEOUT_MS = 10_000;
const ICON_TIMEOUT_MS = 2_500;
const DETAIL_PAGE_TIMEOUT_MS = 6_500;
const RESULT_LIMIT = 120;
const ICON_LOOKUP_RESULT_LIMIT = 32;
const NETHER_BASE_URL = "https://nether.wowhead.com";
const WOW_ICON_BASE_URL = "https://wow.zamimg.com/images/wow/icons/large";

const TYPE_LABELS: Record<Exclude<WowheadEntityType, "all">, string> = {
  item: "Item",
  npc: "NPC",
  quest: "Quest",
  spell: "Spell",
  achievement: "Achievement",
  object: "Object",
  zone: "Zone",
  faction: "Faction",
  currency: "Currency",
  recipe: "Recipe",
  guide: "Guide",
};

const KNOWN_TYPES = new Set<Exclude<WowheadEntityType, "all">>([
  "item",
  "npc",
  "quest",
  "spell",
  "achievement",
  "object",
  "zone",
  "faction",
  "currency",
  "recipe",
  "guide",
]);

type SearchRecord = {
  id?: number;
  name?: string;
  displayName?: string;
  title?: string;
  searchpopularity?: number;
  image?: string;
};

type ListviewConfig = {
  template: string;
  dataKey: string;
};

const iconCache = new Map<string, string | null>();
const detailCache = new Map<string, WowheadEntityDetail | null>();
const engagementCache = new Map<
  string,
  { commentCount?: number; screenshotCount?: number }
>();

type TooltipPayload = {
  name?: string;
  icon?: string;
  quality?: number;
  tooltip?: string;
  tooltip2?: string;
};

type NormalizedResult = {
  title: string;
  type: Exclude<WowheadEntityType, "all">;
  entityId?: string;
  path: string;
  iconUrl?: string;
  popularity: number;
  sectionIndex: number;
};

function normalizeTitle(record: SearchRecord): string | undefined {
  const value = record.displayName ?? record.name ?? record.title;
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTemplate(template: string): Exclude<WowheadEntityType, "all"> | undefined {
  const value = template.toLowerCase();
  if (value === "item") return "item";
  if (value === "npc") return "npc";
  if (value === "quest") return "quest";
  if (value === "spell") return "spell";
  if (value === "achievement") return "achievement";
  if (value === "object") return "object";
  if (value === "zone") return "zone";
  if (value === "faction") return "faction";
  if (value === "currency") return "currency";
  if (value === "recipe") return "recipe";
  if (value === "guide") return "guide";
  return undefined;
}

function buildPath(
  type: Exclude<WowheadEntityType, "all">,
  id: number,
): string {
  if (type === "guide") {
    return `/guide=${id}`;
  }

  return `/${type}=${id}`;
}

function parsePageData(html: string): Map<string, unknown> {
  const map = new Map<string, unknown>();
  const regex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

  let match = regex.exec(html);
  while (match) {
    const attributes = match[1];
    const raw = match[2].trim();
    if (/type="application\/json"/i.test(attributes) === false) {
      match = regex.exec(html);
      continue;
    }

    const idMatch = attributes.match(/id="data\.([^"]+)"/i);
    if (!idMatch) {
      match = regex.exec(html);
      continue;
    }

    const key = idMatch[1];

    try {
      map.set(key, JSON.parse(raw));
    } catch {
      map.delete(key);
    }

    match = regex.exec(html);
  }

  return map;
}

function parseListviews(html: string): ListviewConfig[] {
  const configs: ListviewConfig[] = [];
  const regex = /new\s+Listview\(\{([\s\S]*?)\}\);/gi;

  let match = regex.exec(html);
  while (match) {
    const body = match[1];
    const templateMatch = body.match(/template:\s*"([^"]+)"/i);
    const dataMatch = body.match(/WH\.getPageData\("([^"]+)"\)/i);

    if (!templateMatch || !dataMatch) {
      match = regex.exec(html);
      continue;
    }

    configs.push({
      template: templateMatch[1],
      dataKey: dataMatch[1],
    });

    match = regex.exec(html);
  }

  return configs;
}

function createResult(
  record: SearchRecord,
  type: Exclude<WowheadEntityType, "all">,
  sectionIndex: number,
): NormalizedResult | undefined {
  if (typeof record.id !== "number") {
    return undefined;
  }

  const title = normalizeTitle(record);
  if (!title) {
    return undefined;
  }

  const path = buildPath(type, record.id);
  return {
    title,
    type,
    entityId: String(record.id),
    path,
    iconUrl:
      type === "guide" && typeof record.image === "string"
        ? record.image
        : undefined,
    popularity:
      typeof record.searchpopularity === "number" ? record.searchpopularity : 0,
    sectionIndex,
  };
}

function extractResultsFromListviews(html: string): WowheadResult[] {
  const dataMap = parsePageData(html);
  const listviews = parseListviews(html);

  const merged: NormalizedResult[] = [];
  listviews.forEach((listview, sectionIndex) => {
    const type = normalizeTemplate(listview.template);
    if (!type || KNOWN_TYPES.has(type) === false) {
      return;
    }

    const dataset = dataMap.get(listview.dataKey);
    if (!Array.isArray(dataset)) {
      return;
    }

    dataset.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const result = createResult(entry as SearchRecord, type, sectionIndex);
      if (!result) {
        return;
      }

      merged.push(result);
    });
  });

  const unique = new Set<string>();
  return merged
    .sort((left, right) => {
      if (left.sectionIndex !== right.sectionIndex) {
        return left.sectionIndex - right.sectionIndex;
      }

      if (left.popularity !== right.popularity) {
        return right.popularity - left.popularity;
      }

      return left.title.localeCompare(right.title);
    })
    .filter((entry) => {
      const key = `${entry.type}:${entry.entityId}`;
      if (unique.has(key)) {
        return false;
      }

      unique.add(key);
      return true;
    })
    .slice(0, RESULT_LIMIT)
    .map((entry) => ({
      id: `${entry.type}:${entry.entityId}`,
      title: entry.title,
      type: entry.type,
      typeLabel: TYPE_LABELS[entry.type],
      entityId: entry.entityId,
      path: entry.path,
      url: `${WOWHEAD_BASE_URL}${entry.path}`,
      iconUrl: entry.iconUrl,
    }));
}

function buildWowIconUrl(iconName: string): string {
  return `${WOW_ICON_BASE_URL}/${iconName.toLowerCase()}.jpg`;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

const TOOLTIP_CLASS_COLORS: Record<string, string> = {
  q0: "#9d9d9d",
  q1: "#ffffff",
  q2: "#1eff00",
  q3: "#0070dd",
  q4: "#a335ee",
  q5: "#ff8000",
  q6: "#e6cc80",
  q7: "#00ccff",
  q: "#ffd100",
  "whtt-name": "#ff8000",
  "wowhead-tooltip-requirements": "#9d9d9d",
  moneygold: "#ffd100",
  moneysilver: "#c7c7cf",
  moneycopper: "#c8602c",
};

function colorFromTooltipLine(rawLine: string): string | undefined {
  const classValue = rawLine.match(/class\s*=\s*"([^"]+)"/i)?.[1];
  if (!classValue) {
    return undefined;
  }

  const tokens = classValue
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  for (const token of tokens) {
    const color = TOOLTIP_CLASS_COLORS[token];
    if (color) {
      return color;
    }
  }

  return undefined;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EntityKind = Exclude<WowheadEntityType, "all">;

type RenderPlanEntry = {
  status: "implemented" | "planned";
  relevantFacts: string[];
  notes: string;
};

const TOOLTIP_RENDER_PLAN: Record<EntityKind, RenderPlanEntry> = {
  item: {
    status: "implemented",
    relevantFacts: ["source", "bind", "level", "itemType", "sellPrice"],
    notes: "Handles item table rows and money formatting.",
  },
  spell: {
    status: "implemented",
    relevantFacts: ["requires", "level", "cost", "range", "castTime", "cooldown"],
    notes: "Keeps cast/cost/range/cooldown rows separated.",
  },
  quest: {
    status: "implemented",
    relevantFacts: ["source", "requires", "level"],
    notes: "Keeps objective and requirement lines readable.",
  },
  npc: {
    status: "planned",
    relevantFacts: ["location", "level", "faction"],
    notes: "Add map/location extraction from tooltip payload.",
  },
  achievement: {
    status: "planned",
    relevantFacts: ["points", "criteriaCount", "category"],
    notes: "Parse criteria rows and point values.",
  },
  object: {
    status: "planned",
    relevantFacts: ["location", "contains", "requiredSkill"],
    notes: "Prioritize map and interaction details.",
  },
  zone: {
    status: "planned",
    relevantFacts: ["expansion", "levelRange", "type"],
    notes: "Add zone-level and category extraction.",
  },
  faction: {
    status: "planned",
    relevantFacts: ["side", "standing", "rewards"],
    notes: "Add reputation-specific fact extraction.",
  },
  currency: {
    status: "planned",
    relevantFacts: ["cap", "source", "spendAt"],
    notes: "Prioritize acquisition and spend locations.",
  },
  recipe: {
    status: "planned",
    relevantFacts: ["requires", "profession", "source"],
    notes: "Split profession requirements from source.",
  },
  guide: {
    status: "planned",
    relevantFacts: ["author", "updated", "category"],
    notes: "Guide cards need dedicated summary layout.",
  },
};

export function getTooltipRenderPlan(): Record<EntityKind, RenderPlanEntry> {
  return TOOLTIP_RENDER_PLAN;
}

function normalizeCommonTooltipHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*\/\s*table\s*>/gi, "\n")
    .replace(/<\s*table[^>]*>/gi, "\n")
    .replace(/<\s*\/\s*tr\s*>/gi, "\n")
    .replace(/<\s*tr[^>]*>/gi, "")
    .replace(/<\s*\/\s*th\s*>/gi, "")
    .replace(/<\s*th[^>]*>/gi, " ")
    .replace(/<\s*\/\s*td\s*>/gi, " ")
    .replace(/<\s*td[^>]*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*div[^>]*>/gi, "\n$&")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/\r/g, "");
}

function normalizeItemTooltipHtml(html: string): string {
  return normalizeCommonTooltipHtml(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpellTooltipHtml(html: string): string {
  return normalizeCommonTooltipHtml(html)
    .replace(/<\s*\/\s*td\s*>\s*<\s*th[^>]*>/gi, " | ")
    .replace(/<\s*\/\s*th\s*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeQuestTooltipHtml(html: string): string {
  return normalizeCommonTooltipHtml(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTooltipForType(type: EntityKind, html: string): string {
  if (type === "item") {
    return normalizeItemTooltipHtml(html);
  }

  if (type === "spell") {
    return normalizeSpellTooltipHtml(html);
  }

  if (type === "quest") {
    return normalizeQuestTooltipHtml(html);
  }

  return normalizeCommonTooltipHtml(html).replace(/\n{3,}/g, "\n\n").trim();
}

function tooltipLines(
  html: string,
  entityType: EntityKind,
): Array<{ raw: string; text: string }> {
  return normalizeTooltipForType(entityType, html)
    .split("\n")
    .map((rawLine) => {
      const text = decodeHtmlEntities(rawLine)
        .replace(/<[^>]+>/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return {
        raw: rawLine,
        text,
      };
    })
    .filter((line) => line.text.length > 0);
}

function firstLineMatching(lines: string[], pattern: RegExp): string | undefined {
  return lines.find((line) => pattern.test(line));
}

function extractSellPrice(tooltipHtml: string | undefined): string | undefined {
  if (!tooltipHtml) {
    return undefined;
  }

  const block = tooltipHtml.match(
    /<div[^>]*class="[^"]*whtt-sellprice[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  if (!block) {
    return undefined;
  }

  const gold = block.match(/class="[^"]*moneygold[^"]*"[^>]*>(\d+)/i)?.[1];
  const silver = block.match(/class="[^"]*moneysilver[^"]*"[^>]*>(\d+)/i)?.[1];
  const copper = block.match(/class="[^"]*moneycopper[^"]*"[^>]*>(\d+)/i)?.[1];

  const parts = [
    gold ? `${gold}g` : undefined,
    silver ? `${silver}s` : undefined,
    copper ? `${copper}c` : undefined,
  ].filter((part): part is string => part !== undefined);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function extractSourceInfo(
  entityType: EntityKind,
  tooltipHtml: string | undefined,
): {
  source?: string;
  sourceUrl?: string;
} {
  if (!tooltipHtml) {
    return {};
  }

  const lines = tooltipLines(tooltipHtml, entityType);
  const sourceLine = lines.find((line) =>
    /^(Dropped by|Reward from|Sold by|Created by|Starts|Provided by|Contains|Found in|Teaches)/i.test(
      line.text,
    ),
  );

  if (!sourceLine) {
    return {};
  }

  const href = sourceLine.raw.match(/<a[^>]*href="(\/[^"]+)"/i)?.[1];
  return {
    source: sourceLine.text,
    sourceUrl: href ? `${WOWHEAD_BASE_URL}${href}` : undefined,
  };
}

function extractItemTooltipFacts(tooltipHtml: string | undefined): {
  requires?: string;
  level?: string;
  bind?: string;
  itemType?: string;
  sellPrice?: string;
} {
  if (!tooltipHtml) {
    return {};
  }

  const lines = tooltipLines(tooltipHtml, "item").map((line) => line.text);
  const requires = firstLineMatching(lines, /^Requires\b/i);
  const level =
    firstLineMatching(lines, /^Item Level\s+\d+/i) ??
    firstLineMatching(lines, /^Level\s+\d+/i);
  const bind = firstLineMatching(
    lines,
    /^(Binds when picked up|Binds when equipped|Binds to account|Warbound|Soulbound)/i,
  );
  const itemType = firstLineMatching(
    lines,
    /^(One-Hand|Two-Hand|Main Hand|Off Hand|Ranged|Held In Off-hand|Sword|Axe|Mace|Dagger|Staff|Polearm|Bow|Crossbow|Gun|Wand|Fist Weapon|Shield|Cloth|Leather|Mail|Plate)\b/i,
  );

  return {
    requires,
    level,
    bind,
    itemType,
    sellPrice: extractSellPrice(tooltipHtml),
  };
}

function extractSpellTooltipFacts(tooltipHtml: string | undefined): {
  requires?: string;
  level?: string;
  castTime?: string;
  range?: string;
  cost?: string;
  cooldown?: string;
} {
  if (!tooltipHtml) {
    return {};
  }

  const lines = tooltipLines(tooltipHtml, "spell").map((line) => line.text);
  const requires = firstLineMatching(lines, /^Requires\b/i);
  const level =
    firstLineMatching(lines, /^Level\s+\d+/i) ??
    firstLineMatching(lines, /^Requires Level\s+\d+/i);

  const castLine = firstLineMatching(
    lines,
    /\b(Instant|Channeled|\d+(?:\.\d+)?\s*(?:sec|min)\s+cast)\b/i,
  );
  const rangeLine = firstLineMatching(lines, /\b(Melee Range|\d+\s*yd range|Unlimited Range)\b/i);
  const costLine = firstLineMatching(
    lines,
    /\b(mana|energy|rage|focus|runic power|health|soul shard|essence)\b/i,
  );
  const cooldownLine = firstLineMatching(lines, /\bcooldown\b/i);

  const castTime = castLine?.match(
    /(Instant|Channeled|\d+(?:\.\d+)?\s*(?:sec|min)\s+cast)/i,
  )?.[1];
  const range = rangeLine?.match(/(Melee Range|\d+\s*yd range|Unlimited Range)/i)?.[1];
  const cost = costLine?.match(
    /(\d+(?:\.\d+)?%?\s+of\s+base\s+mana|\d+(?:\.\d+)?\s*(?:mana|energy|rage|focus|runic power|health|soul shards?|essence))/i,
  )?.[1];
  const cooldown = cooldownLine?.match(/(\d+(?:\.\d+)?\s*(?:sec|min|hr)\s+cooldown|cooldown)/i)?.[1];

  return {
    requires,
    level,
    castTime,
    range,
    cost,
    cooldown,
  };
}

function extractQuestTooltipFacts(tooltipHtml: string | undefined): {
  requires?: string;
  level?: string;
} {
  if (!tooltipHtml) {
    return {};
  }

  const lines = tooltipLines(tooltipHtml, "quest").map((line) => line.text);
  const requires = firstLineMatching(lines, /^Requires\b/i);
  const level =
    firstLineMatching(lines, /^Level\s+\d+/i) ??
    firstLineMatching(lines, /^Requires Level\s+\d+/i);

  return {
    requires,
    level,
  };
}

function extractGuideTooltipFacts(tooltipHtml: string | undefined): {
  guideAuthor?: string;
  guideCategory?: string;
  guidePatch?: string;
  guidePreviewMarkdown?: string;
} {
  if (!tooltipHtml) {
    return {};
  }

  const lines = tooltipLines(tooltipHtml, "guide").map((line) => line.text);

  const author = lines
    .map((line) => line.match(/^Wowhead Guide\s+By\s+(.+)$/i)?.[1]?.trim())
    .find((value): value is string => Boolean(value));

  const categoryPatchLine = lines.find((line) => /\bPatch\s+[0-9]+(?:\.[0-9]+)*/i.test(line));
  const patch = categoryPatchLine?.match(/Patch\s+[0-9]+(?:\.[0-9]+)*/i)?.[0];
  const category = categoryPatchLine
    ?.replace(/\bPatch\s+[0-9]+(?:\.[0-9]+)*/i, "")
    .trim();

  const previewLines = lines.filter((line) => {
    if (line === author || line === categoryPatchLine) {
      return false;
    }

    if (/^Wowhead Guide\s+By\s+/i.test(line)) {
      return false;
    }

    if (/\bPatch\s+[0-9]+(?:\.[0-9]+)*/i.test(line) && line.length < 40) {
      return false;
    }

    return true;
  });

  const guidePreviewMarkdown = previewLines
    .slice(1, 4)
    .map((line) => escapeHtml(line))
    .join("<br/><br/>")
    .trim();

  return {
    guideAuthor: author,
    guideCategory: category || undefined,
    guidePatch: patch,
    guidePreviewMarkdown: guidePreviewMarkdown.length > 0 ? guidePreviewMarkdown : undefined,
  };
}

function extractMetaContent(
  html: string,
  attrName: "property" | "name",
  attrValue: string,
): string | undefined {
  const escapedAttr = attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]*${attrName}="${escapedAttr}"[^>]*content="([^"]+)"[^>]*>`,
    "i",
  );
  const match = html.match(regex)?.[1];
  if (!match) {
    return undefined;
  }

  const decoded = decodeHtmlEntities(match).trim();
  return decoded.length > 0 ? decoded : undefined;
}

async function fetchGuidePageSummary(
  result: WowheadResult,
): Promise<{ guideBannerUrl?: string; guideDescription?: string }> {
  if (result.type !== "guide") {
    return {};
  }

  try {
    const response = await fetch(result.url, {
      signal: AbortSignal.timeout(DETAIL_PAGE_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    if (response.ok === false) {
      return {};
    }

    const html = await response.text();
    const guideBannerUrl =
      extractMetaContent(html, "property", "og:image") ??
      extractMetaContent(html, "name", "twitter:image");
    const guideDescription =
      extractMetaContent(html, "property", "og:description") ??
      extractMetaContent(html, "name", "description");

    return {
      guideBannerUrl,
      guideDescription,
    };
  } catch {
    return {};
  }
}

function extractTooltipFacts(
  entityType: EntityKind,
  tooltipHtml: string | undefined,
): {
  requires?: string;
  level?: string;
  bind?: string;
  itemType?: string;
  sellPrice?: string;
  castTime?: string;
  range?: string;
  cost?: string;
  cooldown?: string;
} {
  if (entityType === "item") {
    return extractItemTooltipFacts(tooltipHtml);
  }

  if (entityType === "spell") {
    return extractSpellTooltipFacts(tooltipHtml);
  }

  if (entityType === "quest") {
    return extractQuestTooltipFacts(tooltipHtml);
  }

  return {
    requires:
      tooltipHtml ? firstLineMatching(tooltipLines(tooltipHtml, entityType).map((line) => line.text), /^Requires\b/i) : undefined,
    level:
      tooltipHtml
        ? firstLineMatching(tooltipLines(tooltipHtml, entityType).map((line) => line.text), /^(Item Level\s+\d+|Level\s+\d+|Requires Level\s+\d+)/i)
        : undefined,
  };
}

function renderTooltipLine(text: string, color?: string): string {
  if (!color) {
    return text;
  }

  return `<span style="color: ${color}">${text}</span>`;
}

function normalizeMoneySpans(rawLine: string): string {
  return rawLine
    .replace(
      /<span[^>]*class="[^"]*moneygold[^"]*"[^>]*>(\d+)<\/span>/gi,
      "$1g",
    )
    .replace(
      /<span[^>]*class="[^"]*moneysilver[^"]*"[^>]*>(\d+)<\/span>/gi,
      "$1s",
    )
    .replace(
      /<span[^>]*class="[^"]*moneycopper[^"]*"[^>]*>(\d+)<\/span>/gi,
      "$1c",
    )
    .replace(/(\d+[gsc])(\d+[gsc])/gi, "$1 $2")
    .replace(/\s{2,}/g, " ");
}

function tooltipHtmlToMarkdown(
  html: string | undefined,
  entityType: EntityKind,
): string | undefined {
  if (!html) {
    return undefined;
  }

  const normalized = normalizeTooltipForType(entityType, html);

  const renderedLines = normalized
    .split("\n")
    .map((rawLine) => {
      const color = colorFromTooltipLine(rawLine);
      const plainText = decodeHtmlEntities(normalizeMoneySpans(rawLine))
        .replace(/<[^>]+>/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (plainText.length === 0) {
        return "<br/>";
      }

      const escaped = escapeHtml(plainText);
      return renderTooltipLine(escaped, color);
    })
    .join("<br/>")
    .replace(/(<br\/>){3,}/g, "<br/><br/>")
    .replace(/^(<br\/>)+/g, "")
    .replace(/(<br\/>)+$/g, "")
    .trim();

  return renderedLines.length > 0 ? renderedLines : undefined;
}

async function fetchTooltipPayload(result: WowheadResult): Promise<TooltipPayload | null> {
  if (!result.entityId) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      dataEnv: "1",
      locale: "0",
    });
    const response = await fetch(
      `${NETHER_BASE_URL}/tooltip/${result.type}/${result.entityId}?${params.toString()}`,
      {
        signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      },
    );

    if (response.ok === false) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as TooltipPayload;
  } catch {
    return null;
  }
}

async function fetchTooltipIcon(result: WowheadResult): Promise<string | undefined> {
  if (!result.entityId) {
    return undefined;
  }

  const cacheKey = `${result.type}:${result.entityId}`;
  const cached = iconCache.get(cacheKey);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const payload = await fetchTooltipPayload(result);
  if (
    !payload ||
    typeof payload.icon !== "string" ||
    payload.icon.trim().length === 0
  ) {
    iconCache.set(cacheKey, null);
    return undefined;
  }

  const iconUrl = buildWowIconUrl(payload.icon.trim());
  iconCache.set(cacheKey, iconUrl);
  return iconUrl;
}

function extractArrayLiteral(html: string, variableName: string): string | undefined {
  const marker = `var ${variableName} = `;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return undefined;
  }

  const start = html.indexOf("[", markerIndex + marker.length);
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        inString = false;
        quote = "";
      }

      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

function extractArrayCountByPrefix(html: string, prefix: string): number | undefined {
  const match = html.match(new RegExp(`var\\s+(${prefix}\\d*)\\s*=\\s*\\[`, "i"));
  if (!match || !match[1]) {
    return undefined;
  }

  const arrayLiteral = extractArrayLiteral(html, match[1]);
  if (!arrayLiteral) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(arrayLiteral);
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchWowheadEngagementCounts(
  result: WowheadResult,
): Promise<{ commentCount?: number; screenshotCount?: number }> {
  if (!result.entityId) {
    return {};
  }

  const cacheKey = `${result.type}:${result.entityId}`;
  const cached = engagementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(result.url, {
      signal: AbortSignal.timeout(DETAIL_PAGE_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
    });

    if (response.ok === false) {
      return {};
    }

    const html = await response.text();
    const next = {
      commentCount: extractArrayCountByPrefix(html, "lv_comments"),
      screenshotCount: extractArrayCountByPrefix(html, "lv_screenshots"),
    };

    engagementCache.set(cacheKey, next);
    return next;
  } catch {
    return {};
  }
}

export async function fetchWowheadEntityDetail(
  result: WowheadResult,
): Promise<WowheadEntityDetail | undefined> {
  if (!result.entityId) {
    return undefined;
  }

  const cacheKey = `${result.type}:${result.entityId}`;
  const cached = detailCache.get(cacheKey);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const payload = await fetchTooltipPayload(result);

  if (!payload) {
    detailCache.set(cacheKey, null);
    return undefined;
  }

  const iconUrl =
    typeof payload.icon === "string" && payload.icon.trim().length > 0
      ? buildWowIconUrl(payload.icon.trim())
      : result.iconUrl;

  if (iconUrl) {
    iconCache.set(cacheKey, iconUrl);
  }

  const cachedEngagement = engagementCache.get(cacheKey);
  const guideFacts = extractGuideTooltipFacts(payload.tooltip);
  const guidePageSummary = await fetchGuidePageSummary(result);

  const detail: WowheadEntityDetail = {
    name:
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : result.title,
    iconUrl,
    quality: typeof payload.quality === "number" ? payload.quality : undefined,
    commentCount: cachedEngagement?.commentCount,
    screenshotCount: cachedEngagement?.screenshotCount,
    ...extractSourceInfo(result.type, payload.tooltip),
    ...extractTooltipFacts(result.type, payload.tooltip),
    ...guideFacts,
    ...guidePageSummary,
    tooltipHtml:
      typeof payload.tooltip === "string" && payload.tooltip.trim().length > 0
        ? payload.tooltip
        : undefined,
    secondaryTooltipHtml:
      typeof payload.tooltip2 === "string" && payload.tooltip2.trim().length > 0
        ? payload.tooltip2
        : undefined,
    tooltipMarkdown: tooltipHtmlToMarkdown(payload.tooltip, result.type),
    secondaryTooltipMarkdown: tooltipHtmlToMarkdown(payload.tooltip2, result.type),
    tooltipSvgDataUrl: buildTooltipSvgDataUrl({
      title:
        typeof payload.name === "string" && payload.name.trim().length > 0
          ? payload.name.trim()
          : result.title,
      quality: typeof payload.quality === "number" ? payload.quality : undefined,
      iconUrl,
      tooltipHtml:
        typeof payload.tooltip === "string" && payload.tooltip.trim().length > 0
          ? payload.tooltip
          : undefined,
    }),
    secondaryTooltipSvgDataUrl: buildTooltipSvgDataUrl({
      title: `${
        typeof payload.name === "string" && payload.name.trim().length > 0
          ? payload.name.trim()
          : result.title
      } (Additional)`,
      quality: typeof payload.quality === "number" ? payload.quality : undefined,
      iconUrl,
      tooltipHtml:
        typeof payload.tooltip2 === "string" && payload.tooltip2.trim().length > 0
          ? payload.tooltip2
          : undefined,
    }),
  };

  detailCache.set(cacheKey, detail);
  return detail;
}

async function enrichResultsWithTooltipIcons(
  results: WowheadResult[],
): Promise<WowheadResult[]> {
  const pending = results
    .filter((result) => result.iconUrl === undefined && result.entityId !== undefined)
    .slice(0, ICON_LOOKUP_RESULT_LIMIT);

  if (pending.length === 0) {
    return results;
  }

  const iconById = new Map<string, string>();
  await Promise.all(
    pending.map(async (result) => {
      const iconUrl = await fetchTooltipIcon(result);
      if (!iconUrl) {
        return;
      }

      iconById.set(result.id, iconUrl);
    }),
  );

  return results.map((result) => {
    const iconUrl = iconById.get(result.id);
    if (!iconUrl) {
      return result;
    }

    return {
      ...result,
      iconUrl,
    };
  });
}

export async function searchWowhead(
  query: string,
  entityType: WowheadEntityType,
): Promise<WowheadResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
  });
  const response = await fetch(`${WOWHEAD_BASE_URL}/search?${params.toString()}`, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    },
  });

  if (response.ok === false) {
    throw new Error(
      `Wowhead search failed: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  const parsed = extractResultsFromListviews(html);
  const filtered =
    entityType === "all"
      ? parsed
      : parsed.filter((result) => result.type === entityType);

  return enrichResultsWithTooltipIcons(filtered);
}
