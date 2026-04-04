import { Cache } from "@vicinae/api";
import type { WowheadResult } from "./types";

const FAVORITES_KEY = "wowhead-favorites-v1";
const cache = new Cache();

function isWowheadResult(value: unknown): value is WowheadResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WowheadResult>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.typeLabel === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.url === "string"
  );
}

function parseFavorites(raw: string | undefined): WowheadResult[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isWowheadResult);
  } catch {
    return [];
  }
}

function writeFavorites(next: WowheadResult[]): void {
  cache.set(FAVORITES_KEY, JSON.stringify(next));
}

export function readFavorites(): WowheadResult[] {
  return parseFavorites(cache.get(FAVORITES_KEY));
}

export function isFavoriteResult(id: string, favorites: WowheadResult[]): boolean {
  return favorites.some((entry) => entry.id === id);
}

export function addFavorite(result: WowheadResult): WowheadResult[] {
  const favorites = readFavorites();
  if (isFavoriteResult(result.id, favorites)) {
    return favorites;
  }

  const next = [result, ...favorites].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
  writeFavorites(next);
  return next;
}

export function removeFavorite(resultId: string): WowheadResult[] {
  const favorites = readFavorites();
  const next = favorites.filter((entry) => entry.id !== resultId);
  writeFavorites(next);
  return next;
}
