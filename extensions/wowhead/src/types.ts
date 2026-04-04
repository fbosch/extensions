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

export type WowheadCommentPreview = {
  id: number;
  author: string;
  body: string;
  rating?: number;
  date?: string;
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
  guideBannerUrl?: string;
  guideAuthor?: string;
  guideCategory?: string;
  guidePatch?: string;
  guideDescription?: string;
  guidePreviewMarkdown?: string;
  highlightedScreenshotUrl?: string;
  topComments?: WowheadCommentPreview[];
  tooltipHtml?: string;
  secondaryTooltipHtml?: string;
  tooltipMarkdown?: string;
  secondaryTooltipMarkdown?: string;
};
