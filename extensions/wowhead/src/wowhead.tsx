import { useQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  Action,
  ActionPanel,
  closeMainWindow,
  Icon,
  Keyboard,
  List,
  open,
  showToast,
  Toast,
} from "@vicinae/api";
import { useDeferredValue, useMemo, useState } from "react";
import { searchWowhead } from "./api";
import { ResultPage } from "./components/ResultPage";
import {
  CACHE_MAX_AGE_MS,
  ENTITY_TYPES,
  SEARCH_CACHE_VERSION,
  SEARCH_DEBOUNCE_FALLBACK_TEXT,
} from "./constants";
import { persister, queryClient } from "./queryClient";
import type { WowheadEntityType, WowheadResult } from "./types";

const TYPE_ICONS: Record<WowheadResult["type"], Icon> = {
  item: Icon.Box,
  npc: Icon.Person,
  quest: Icon.BlankDocument,
  spell: Icon.Code,
  achievement: Icon.Star,
  object: Icon.AppWindowSidebarLeft,
  zone: Icon.Globe01,
  faction: Icon.Person,
  currency: Icon.Coins,
  recipe: Icon.BlankDocument,
  guide: Icon.Globe01,
};

async function openResultInBrowser(result: WowheadResult): Promise<void> {
  await open(result.url);
  await showToast({
    style: Toast.Style.Success,
    title: "Opened in browser",
    message: result.title,
  });
  await closeMainWindow();
}

function WowheadCommand() {
  const [searchText, setSearchText] = useState("");
  const [entityType, setEntityType] = useState<WowheadEntityType>("all");
  const deferredSearch = useDeferredValue(searchText);

  const query = useQuery({
    queryKey: [
      "wowhead",
      "search",
      SEARCH_CACHE_VERSION,
      deferredSearch,
      entityType,
    ],
    queryFn: () => searchWowhead(deferredSearch, entityType),
    enabled: deferredSearch.trim().length > 0,
  });

  const results = useMemo(() => query.data ?? [], [query.data]);

  const emptyView = (() => {
    if (deferredSearch.trim().length === 0) {
      return (
        <List.EmptyView
          title="Search Wowhead"
          description="Enter a query to browse retail Wowhead results"
        />
      );
    }

    if (query.isError) {
      return (
        <List.EmptyView
          title="Search failed"
          description="Use Refresh to retry or open the browser search"
        />
      );
    }

    return (
      <List.EmptyView
        title="No results"
        description="Try broader terms or change the type filter"
      />
    );
  })();

  return (
    <List
      isLoading={query.isLoading || query.isFetching}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={SEARCH_DEBOUNCE_FALLBACK_TEXT}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Entity Type"
          value={entityType}
          onChange={(value: string) => setEntityType(value as WowheadEntityType)}
        >
          {ENTITY_TYPES.map((option) => (
            <List.Dropdown.Item
              key={option.value}
              title={option.title}
              value={option.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {results.length === 0
        ? emptyView
        : results.map((result: WowheadResult) => (
            <List.Item
              key={result.id}
              title={result.title}
              subtitle={result.entityId ? `ID ${result.entityId}` : result.typeLabel}
              icon={result.iconUrl ? { source: result.iconUrl } : TYPE_ICONS[result.type]}
              accessories={[{ text: result.typeLabel }]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Open Full Detail"
                    icon={Icon.AppWindowSidebarRight}
                    shortcut={Keyboard.Shortcut.Common.Open}
                    target={<ResultPage result={result} />}
                  />
                  <Action
                    title="Open on Wowhead"
                    icon={Icon.Globe01}
                    onAction={() => openResultInBrowser(result)}
                  />
                  <Action.CopyToClipboard
                    title="Copy URL"
                    content={result.url}
                    shortcut={Keyboard.Shortcut.Common.Copy}
                  />
                  {deferredSearch.trim().length > 0 && (
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                      onAction={async () => {
                        await queryClient.invalidateQueries({
                          queryKey: ["wowhead", "search"],
                        });
                        await showToast({
                          style: Toast.Style.Success,
                          title: "Refreshed results",
                        });
                      }}
                    />
                  )}
                </ActionPanel>
              }
            />
          ))}
    </List>
  );
}

export default function Command() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS }}
    >
      <WowheadCommand />
    </PersistQueryClientProvider>
  );
}
