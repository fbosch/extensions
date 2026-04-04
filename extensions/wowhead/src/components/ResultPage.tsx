import {
  Action,
  ActionPanel,
  closeMainWindow,
  Detail,
  Icon,
  Keyboard,
  open,
  showToast,
  Toast,
} from "@vicinae/api";
import { useEffect, useState } from "react";
import { fetchWowheadEngagementCounts, fetchWowheadEntityDetail } from "../api";
import type { WowheadEntityDetail, WowheadResult } from "../types";

const QUALITY_LABELS: Record<number, string> = {
  0: "Poor",
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Epic",
  5: "Legendary",
  6: "Artifact",
  7: "Heirloom",
};

function buildMarkdown(result: WowheadResult, detail?: WowheadEntityDetail): string {
  const heading = detail?.name ?? result.title;
  const primaryTooltip = detail?.tooltipMarkdown?.trim();
  const secondaryTooltip = detail?.secondaryTooltipMarkdown?.trim();
  const primaryTooltipWithIcon =
    detail?.iconUrl && primaryTooltip
      ? `<span><img src="${detail.iconUrl}" alt="${heading}" width="36" height="36" style="display:inline-block;vertical-align:middle;margin-right:0;" />&nbsp;&nbsp;${primaryTooltip}</span>`
      : primaryTooltip;
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

export function ResultPage({ result }: { result: WowheadResult }) {
  const [detail, setDetail] = useState<WowheadEntityDetail | undefined>();
  const [isLoading, setIsLoading] = useState(result.entityId !== undefined);
  const [engagement, setEngagement] = useState<{
    commentCount?: number;
    screenshotCount?: number;
  }>({});

  useEffect(() => {
    let isMounted = true;

    if (result.entityId === undefined) {
      setDetail(undefined);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchWowheadEntityDetail(result)
      .then((nextDetail) => {
        if (isMounted === false) {
          return;
        }

        setDetail(nextDetail);
      })
      .finally(() => {
        if (isMounted === false) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [result]);

  useEffect(() => {
    let isMounted = true;

    setEngagement({});
    if (result.entityId === undefined) {
      return;
    }

    fetchWowheadEngagementCounts(result).then((next) => {
      if (isMounted === false) {
        return;
      }

      setEngagement(next);
    });

    return () => {
      isMounted = false;
    };
  }, [result]);

  const displayTitle = detail?.name ?? result.title;
  const commentsUrl = `${result.url}#comments`;
  const screenshotsUrl = `${result.url}#screenshots`;
  const relatedUrl = `${result.url}#related`;
  const markdownLink = `[${displayTitle}](${result.url})`;
  const screenshotCount = detail?.screenshotCount ?? engagement.screenshotCount;
  const screenshotsLinkText =
    screenshotCount !== undefined
      ? `#screenshots (${screenshotCount})`
      : "#screenshots";

  return (
    <Detail
      navigationTitle={result.title}
      markdown={isLoading ? "Loading details..." : buildMarkdown(result, detail)}
      actions={
        <ActionPanel>
          <Action
            title="Open on Wowhead"
            icon={Icon.Globe01}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={async () => {
              await open(result.url);
              await showToast({
                style: Toast.Style.Success,
                title: "Opened in browser",
                message: result.title,
              });
              await closeMainWindow();
            }}
          />
          <Action.CopyToClipboard
            title="Copy URL"
            content={result.url}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          {result.entityId && (
            <Action.CopyToClipboard title="Copy ID" content={result.entityId} />
          )}
          <Action.CopyToClipboard title="Copy Path" content={result.path} />
          <Action.CopyToClipboard title="Copy Markdown Link" content={markdownLink} />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Type" text={result.typeLabel} />
          {result.entityId && <Detail.Metadata.Label title="ID" text={result.entityId} />}
          {detail?.quality !== undefined && (
            <Detail.Metadata.Label
              title="Quality"
              text={QUALITY_LABELS[detail.quality] ?? `Quality ${detail.quality}`}
              icon={{ source: Icon.Star }}
            />
          )}
          {detail?.sourceUrl ? (
            <Detail.Metadata.Link title="Source" text={detail.source ?? "Open Source"} target={detail.sourceUrl} />
          ) : (
            detail?.source && <Detail.Metadata.Label title="Source" text={detail.source} />
          )}
          {detail?.requires && <Detail.Metadata.Label title="Requires" text={detail.requires} />}
          {detail?.level && <Detail.Metadata.Label title="Level" text={detail.level} />}
          {detail?.bind && <Detail.Metadata.Label title="Bind" text={detail.bind} />}
          {detail?.itemType && <Detail.Metadata.Label title="Item Type" text={detail.itemType} />}
          {detail?.sellPrice && <Detail.Metadata.Label title="Sell Price" text={detail.sellPrice} />}
          {detail?.cost && <Detail.Metadata.Label title="Cost" text={detail.cost} />}
          {detail?.range && <Detail.Metadata.Label title="Range" text={detail.range} />}
          {detail?.castTime && <Detail.Metadata.Label title="Cast Time" text={detail.castTime} />}
          {detail?.cooldown && <Detail.Metadata.Label title="Cooldown" text={detail.cooldown} />}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Path" text={result.path} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link title="Open Wowhead" text="Retail" target={result.url} />
          <Detail.Metadata.Link title="Comments" text="#comments" target={commentsUrl} />
          <Detail.Metadata.Link
            title="Screenshots"
            text={screenshotsLinkText}
            target={screenshotsUrl}
          />
          <Detail.Metadata.Link title="Related" text="#related" target={relatedUrl} />
        </Detail.Metadata>
      }
    />
  );
}
