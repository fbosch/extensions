type TooltipSvgOptions = {
  title: string;
  quality?: number;
  iconUrl?: string;
  tooltipHtml?: string;
};

type TooltipLine = {
  text: string;
  color: string;
};

const TOOLTIP_WIDTH = 240;
const TOOLTIP_PADDING_X = 16;
const TOOLTIP_PADDING_Y = 14;
const HEADER_ICON_SIZE = 44;
const HEADER_TEXT_LEFT = TOOLTIP_PADDING_X + HEADER_ICON_SIZE + 12;
const BODY_TEXT_LEFT = TOOLTIP_PADDING_X;
const BODY_TEXT_RIGHT = TOOLTIP_WIDTH - TOOLTIP_PADDING_X;
const BODY_LINE_HEIGHT = 24;
const HEADER_LINE_HEIGHT = 24;
const FONT_STACK = "Verdana, Arial, sans-serif";

const DEFAULT_TEXT_COLOR = "#ffd100";

const QUALITY_COLORS: Record<number, string> = {
  0: "#9d9d9d",
  1: "#ffffff",
  2: "#1eff00",
  3: "#0070dd",
  4: "#a335ee",
  5: "#ff8000",
  6: "#e6cc80",
  7: "#00ccff",
};

const CLASS_COLORS: Record<string, string> = {
  q: "#ffd100",
  q0: "#9d9d9d",
  q1: "#ffffff",
  q2: "#1eff00",
  q3: "#0070dd",
  q4: "#a335ee",
  q5: "#ff8000",
  q6: "#e6cc80",
  q7: "#00ccff",
  moneygold: "#ffd100",
  moneysilver: "#c7c7cf",
  moneycopper: "#c8602c",
  "tooltip-description": "#9d9d9d",
};

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function normalizeTooltipHtml(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*div[^>]*>/gi, "")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/\r/g, "");
}

function classColorFromLine(rawLine: string): string {
  const classes = rawLine.match(/class\s*=\s*"([^"]+)"/i)?.[1];
  if (!classes) {
    return DEFAULT_TEXT_COLOR;
  }

  const tokens = classes
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  for (const token of tokens) {
    const color = CLASS_COLORS[token];
    if (color) {
      return color;
    }
  }

  return DEFAULT_TEXT_COLOR;
}

function cleanTooltipLine(rawLine: string): string {
  const decoded = decodeHtmlEntities(rawLine).replace(/<[^>]+>/g, "").trim();
  return decoded;
}

function splitIntoLines(html: string): TooltipLine[] {
  const normalized = normalizeTooltipHtml(html);
  const rawLines = normalized.split("\n");

  return rawLines
    .map((rawLine) => ({
      text: cleanTooltipLine(rawLine),
      color: classColorFromLine(rawLine),
    }))
    .filter((line) => line.text.length > 0);
}

function wrapLine(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current.length > 0) {
        lines.push(current);
      }
      current = word;
      continue;
    }

    current = (current + " " + word).trim();
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [text];
}

function qualityColor(quality: number | undefined): string {
  if (quality === undefined) {
    return "#ffd100";
  }

  return QUALITY_COLORS[quality] ?? "#ffd100";
}

export function buildTooltipSvgDataUrl(options: TooltipSvgOptions): string | undefined {
  const tooltipHtml = options.tooltipHtml?.trim();
  if (!tooltipHtml) {
    return undefined;
  }

  const maxChars = Math.floor((BODY_TEXT_RIGHT - BODY_TEXT_LEFT) / 9.6);
  const rawLines = splitIntoLines(tooltipHtml);
  const bodyLines: TooltipLine[] = [];

  for (const line of rawLines) {
    const wrapped = wrapLine(line.text, maxChars);
    wrapped.forEach((segment) => {
      bodyLines.push({
        text: segment,
        color: line.color,
      });
    });
  }

  const headerHeight = options.iconUrl ? HEADER_ICON_SIZE : HEADER_LINE_HEIGHT;
  const bodyHeight = bodyLines.length * BODY_LINE_HEIGHT;
  const totalHeight = TOOLTIP_PADDING_Y * 2 + headerHeight + 10 + bodyHeight;

  const titleColor = qualityColor(options.quality);
  let y = TOOLTIP_PADDING_Y + HEADER_LINE_HEIGHT;
  const textNodes: string[] = [];

  const titleX = options.iconUrl ? HEADER_TEXT_LEFT : BODY_TEXT_LEFT;
  textNodes.push(
    `<text x="${titleX}" y="${y}" font-size="24" font-family="${FONT_STACK}" fill="${titleColor}" font-weight="700">${escapeXml(options.title)}</text>`,
  );

  y = TOOLTIP_PADDING_Y + headerHeight + 12;
  for (const line of bodyLines) {
    textNodes.push(
      `<text x="${BODY_TEXT_LEFT}" y="${y}" font-size="19" font-family="${FONT_STACK}" fill="${line.color}">${escapeXml(line.text)}</text>`,
    );
    y += BODY_LINE_HEIGHT;
  }

  const iconNode = options.iconUrl
    ? `<rect x="${TOOLTIP_PADDING_X - 1}" y="${TOOLTIP_PADDING_Y - 1}" width="${HEADER_ICON_SIZE + 2}" height="${HEADER_ICON_SIZE + 2}" fill="#111726" stroke="#5f6678" stroke-width="1" rx="3" ry="3" />` +
      `<image x="${TOOLTIP_PADDING_X}" y="${TOOLTIP_PADDING_Y}" width="${HEADER_ICON_SIZE}" height="${HEADER_ICON_SIZE}" xlink:href="${escapeXml(options.iconUrl)}" href="${escapeXml(options.iconUrl)}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TOOLTIP_WIDTH}" height="${Math.max(120, totalHeight)}" viewBox="0 0 ${TOOLTIP_WIDTH} ${Math.max(120, totalHeight)}">`,
    `<rect x="0.5" y="0.5" width="${TOOLTIP_WIDTH - 1}" height="${Math.max(120, totalHeight) - 1}" rx="6" ry="6" fill="#0d0f14" stroke="#313745" stroke-width="1"/>`,
    `<rect x="1" y="1" width="${TOOLTIP_WIDTH - 2}" height="${Math.max(120, totalHeight) - 2}" rx="6" ry="6" fill="url(#bg)"/>`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#121726"/><stop offset="100%" stop-color="#0a0d14"/></linearGradient></defs>`,
    iconNode,
    ...textNodes,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
