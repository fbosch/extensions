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
import { fetchWowheadEntityDetail } from "../api";
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

export function ResultPage({ result }: { result: WowheadResult }) {
  const [detail, setDetail] = useState<WowheadEntityDetail | undefined>();
  const [isLoading, setIsLoading] = useState(result.entityId !== undefined);

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
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Path" text={result.path} />
          <Detail.Metadata.Link title="Wowhead" text={result.url} target={result.url} />
        </Detail.Metadata>
      }
    />
  );
}
