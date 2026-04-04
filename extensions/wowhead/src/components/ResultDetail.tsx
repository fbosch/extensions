import { useQuery } from "@tanstack/react-query";
import { List } from "@vicinae/api";
import { fetchWowheadEntityDetail } from "../api";
import type { WowheadEntityDetail, WowheadResult } from "../types";

function buildMarkdown(result: WowheadResult, detail?: WowheadEntityDetail): string {
  const heading = detail?.name ?? result.title;
  const hasTooltip =
    (detail?.tooltipMarkdown?.trim().length ?? 0) > 0 ||
    (detail?.secondaryTooltipMarkdown?.trim().length ?? 0) > 0;

  const sections = [
    detail?.iconUrl
      ? `<img src="${detail.iconUrl}" alt="${heading}" width="32" height="32" />`
      : undefined,
    hasTooltip === false ? `# ${heading}` : undefined,
    detail?.tooltipMarkdown,
    detail?.secondaryTooltipMarkdown
      ? `\n\n${detail.secondaryTooltipMarkdown}`
      : undefined,
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
