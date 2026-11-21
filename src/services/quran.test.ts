import { afterEach, describe, expect, it, vi } from "vitest";
import { adjacentQuranPage, fetchQuranPage, type QuranPage } from "./quran";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adjacentQuranPage", () => {
  it("moves in the requested direction without crossing the page bounds", () => {
    expect(adjacentQuranPage(22, "previous")).toBe(21);
    expect(adjacentQuranPage(22, "next")).toBe(23);
    expect(adjacentQuranPage(1, "previous")).toBeNull();
    expect(adjacentQuranPage(604, "next")).toBeNull();
  });
});

describe("fetchQuranPage", () => {
  it("uses a valid local page cache without a network request", async () => {
    const cachedPage: QuranPage = {
      number: 1,
      cached: false,
      ayahs: [{
        number: 1,
        numberInSurah: 1,
        page: 1,
        surah: {
          number: 1,
          name: "سُورَةُ ٱلْفَاتِحَةِ",
          englishName: "Al-Fatiha",
          englishNameTranslation: "The Opening",
          numberOfAyahs: 7,
        },
      }],
    };
    const storage = new Map([["azkar.quran.page.v1.1", JSON.stringify(cachedPage)]]);
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    const fetch = vi.fn();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("fetch", fetch);

    await expect(fetchQuranPage(1)).resolves.toEqual({ ...cachedPage, cached: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
