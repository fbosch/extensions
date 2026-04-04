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
  useNavigation,
} from "@vicinae/api";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { fetchWowheadEntityDetail, searchWowhead } from "./api";
import { ResultPage } from "./components/ResultPage";
import {
  CACHE_MAX_AGE_MS,
  ENTITY_TYPES,
  SEARCH_CACHE_VERSION,
  SEARCH_DEBOUNCE_FALLBACK_TEXT,
} from "./constants";
import { addFavorite, isFavoriteResult, readFavorites, removeFavorite } from "./favorites";
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
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [entityType, setEntityType] = useState<WowheadEntityType>("all");
  const [favorites, setFavorites] = useState<WowheadResult[]>([]);
  const deferredSearch = useDeferredValue(searchText);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

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
  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.id)), [favorites]);

  async function toggleFavorite(result: WowheadResult): Promise<void> {
    const isFavorite = isFavoriteResult(result.id, favorites);
    const next = isFavorite ? removeFavorite(result.id) : addFavorite(result);
    setFavorites(next);

    await showToast({
      style: Toast.Style.Success,
      title: isFavorite ? "Removed from favorites" : "Added to favorites",
      message: result.title,
    });
  }

  function renderResultItem(result: WowheadResult) {
    const isFavorite = favoriteIds.has(result.id);

    return (
      <List.Item
        key={result.id}
        title={result.title}
        subtitle={result.entityId ? `ID ${result.entityId}` : result.typeLabel}
        icon={result.iconUrl ? { source: result.iconUrl } : TYPE_ICONS[result.type]}
        accessories={[
          ...(isFavorite ? [{ icon: Icon.Star }] : []),
          { text: result.typeLabel },
        ]}
        actions={
          <ActionPanel>
            <Action
              title="Open Full Detail"
              icon={Icon.AppWindowSidebarRight}
              shortcut={Keyboard.Shortcut.Common.Open}
              onAction={async () => {
                const detail = await fetchWowheadEntityDetail(result);
                push(<ResultPage result={result} initialDetail={detail} />);
              }}
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
            <Action
              title={isFavorite ? "Remove Favorite" : "Add Favorite"}
              icon={isFavorite ? Icon.StarDisabled : Icon.Star}
              shortcut={isFavorite ? Keyboard.Shortcut.Common.Remove : Keyboard.Shortcut.Common.Pin}
              onAction={() => toggleFavorite(result)}
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
    );
  }

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
      {deferredSearch.trim().length === 0 ? (
        favorites.length === 0 ? (
          emptyView
        ) : (
          <List.Section title="Favorites" subtitle={`${favorites.length}`}>
            {favorites.map((result) => renderResultItem(result))}
          </List.Section>
        )
      ) : results.length === 0 ? (
        emptyView
      ) : (
        results.map((result) => renderResultItem(result))
      )}
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
