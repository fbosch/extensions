import { ENTITY_TYPES } from "./constants";

export type WowheadEntityType = (typeof ENTITY_TYPES)[number]["value"];

export type WowheadResult = {
  id: string;
  title: string;
  type: Exclude<WowheadEntityType, "all">;
  typeLabel: string;
  entityId?: string;
  path: string;
  url: string;
  iconUrl?: string;
};

export type WowheadEntityDetail = {
  name: string;
  iconUrl?: string;
  quality?: number;
  commentCount?: number;
  screenshotCount?: number;
  source?: string;
  sourceUrl?: string;
  requires?: string;
  level?: string;
  bind?: string;
  itemType?: string;
  sellPrice?: string;
  castTime?: string;
  range?: string;
  cost?: string;
  cooldown?: string;
  tooltipHtml?: string;
  secondaryTooltipHtml?: string;
  tooltipSvgDataUrl?: string;
  secondaryTooltipSvgDataUrl?: string;
  tooltipMarkdown?: string;
  secondaryTooltipMarkdown?: string;
};
