import { WOWHEAD_BASE_URL } from "./constants";
import { buildTooltipSvgDataUrl } from "./tooltipSvg";
import type {
  WowheadEntityDetail,
  WowheadEntityType,
  WowheadResult,
} from "./types";

const SEARCH_TIMEOUT_MS = 10_000;
const ICON_TIMEOUT_MS = 2_500;
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

function renderTooltipLine(text: string, color?: string): string {
  if (!color) {
    return text;
  }

  return `<span style="color: ${color}">${text}</span>`;
}

function tooltipHtmlToMarkdown(html: string | undefined): string | undefined {
  if (!html) {
    return undefined;
  }

  const normalized = html
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
    .replace(/<\s*div[^>]*>/gi, "")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/\r/g, "");

  const renderedLines = normalized
    .split("\n")
    .map((rawLine) => {
      const color = colorFromTooltipLine(rawLine);
      const plainText = decodeHtmlEntities(rawLine)
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

  const detail: WowheadEntityDetail = {
    name:
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : result.title,
    iconUrl,
    quality: typeof payload.quality === "number" ? payload.quality : undefined,
    tooltipHtml:
      typeof payload.tooltip === "string" && payload.tooltip.trim().length > 0
        ? payload.tooltip
        : undefined,
    secondaryTooltipHtml:
      typeof payload.tooltip2 === "string" && payload.tooltip2.trim().length > 0
        ? payload.tooltip2
        : undefined,
    tooltipMarkdown: tooltipHtmlToMarkdown(payload.tooltip),
    secondaryTooltipMarkdown: tooltipHtmlToMarkdown(payload.tooltip2),
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
