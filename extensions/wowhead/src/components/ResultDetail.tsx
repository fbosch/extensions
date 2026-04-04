import { useQuery } from "@tanstack/react-query";
import { List } from "@vicinae/api";
import { fetchWowheadEntityDetail } from "../api";
import type { WowheadEntityDetail, WowheadResult } from "../types";

function buildMarkdown(result: WowheadResult, detail?: WowheadEntityDetail): string {
  const heading = detail?.name ?? result.title;
  const primaryTooltip = detail?.tooltipMarkdown?.trim();
  const secondaryTooltip = detail?.secondaryTooltipMarkdown?.trim();
  const primaryTooltipWithExtraBreak = primaryTooltip?.replace(/<br\s*\/?>/i, "<br/><br/>");
  const primaryTooltipWithIcon =
    detail?.iconUrl && primaryTooltipWithExtraBreak
      ? `<span><img src="${detail.iconUrl}" alt="${heading}" width="36" height="36" style="display:inline-block;vertical-align:middle;margin-right:0;" />&nbsp;&nbsp;${primaryTooltipWithExtraBreak}</span>`
      : primaryTooltipWithExtraBreak;
  const hasTooltip =
    (primaryTooltipWithIcon?.length ?? 0) > 0 ||
    (secondaryTooltip?.length ?? 0) > 0;

  const sections = [
    hasTooltip === false ? `# ${heading}` : undefined,
    primaryTooltipWithIcon,
    secondaryTooltip,
  ].filter((section): section is string => section !== undefined);

  return sections.join("\n\n");
}

export function ResultDetail({
  result,
  isLoading,
}: {
  result: WowheadResult;
  isLoading?: boolean;
}) {
  const detailQuery = useQuery({
    queryKey: ["wowhead", "detail", result.id],
    queryFn: () => fetchWowheadEntityDetail(result),
    enabled: result.entityId !== undefined,
  });

  const detail = detailQuery.data;

  return (
    <List.Item.Detail
      isLoading={isLoading || detailQuery.isLoading}
      markdown={buildMarkdown(result, detail)}
      metadata={undefined}
    />
  );
}
