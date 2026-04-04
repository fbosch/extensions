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
  tooltipHtml?: string;
  secondaryTooltipHtml?: string;
  tooltipSvgDataUrl?: string;
  secondaryTooltipSvgDataUrl?: string;
  tooltipMarkdown?: string;
  secondaryTooltipMarkdown?: string;
};
