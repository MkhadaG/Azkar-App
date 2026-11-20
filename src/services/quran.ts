const api = "https://api.alquran.cloud/v1";
const pageCachePrefix = "azkar.quran.page.v1.";
const pageLookupPrefix = "azkar.quran.page-lookup.v1.";
const listCacheKey = "azkar.quran.surahs.v1";

export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
}

export interface QuranPageVerse {
  number: number;
  numberInSurah: number;
  page: number;
  surah: SurahInfo;
}

export interface QuranPage {
  number: number;
  ayahs: QuranPageVerse[];
  cached: boolean;
}

interface ApiResponse<T> {
  code: number;
  data: T;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Quran text service returned ${response.status}.`);
  const result = (await response.json()) as ApiResponse<T>;
  if (result.code !== 200 || result.data === undefined) {
    throw new Error("Quran text service returned an invalid response.");
  }
  return result.data;
}

function isPageNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 604;
}

export function adjacentQuranPage(
  page: number,
  direction: "previous" | "next",
): number | null {
  if (!isPageNumber(page)) return null;
  const adjacent = page + (direction === "previous" ? -1 : 1);
  return isPageNumber(adjacent) ? adjacent : null;
}

function savePage(page: QuranPage): void {
  try {
    window.localStorage.setItem(`${pageCachePrefix}${page.number}`, JSON.stringify(page));
    for (const ayah of page.ayahs) {
      window.localStorage.setItem(
        `${pageLookupPrefix}${ayah.surah.number}:${ayah.numberInSurah}`,
        String(page.number),
      );
    }
  } catch (reason) {
    console.warn("Could not cache this Quran page on the device.", reason);
  }
}

export async function fetchSurahList(): Promise<SurahInfo[]> {
  const cached = window.localStorage.getItem(listCacheKey);
  try {
    const data = await requestJson<SurahInfo[]>(`${api}/surah`);
    window.localStorage.setItem(listCacheKey, JSON.stringify(data));
    return data;
  } catch (reason) {
    if (cached) return JSON.parse(cached) as SurahInfo[];
    throw reason;
  }
}

export async function fetchQuranPageNumber(surah: number, ayah: number): Promise<number> {
  const cacheKey = `${pageLookupPrefix}${surah}:${ayah}`;
  const cached = window.localStorage.getItem(cacheKey);
  try {
    const data = await requestJson<{ page: number }>(`${api}/ayah/${surah}:${ayah}/quran-uthmani`);
    if (!isPageNumber(data.page)) throw new Error("Quran text service returned an invalid page number.");
    window.localStorage.setItem(cacheKey, String(data.page));
    return data.page;
  } catch (reason) {
    const cachedPage = cached ? Number(cached) : NaN;
    if (isPageNumber(cachedPage)) return cachedPage;
    throw reason;
  }
}

export async function fetchQuranPage(number: number): Promise<QuranPage> {
  if (!isPageNumber(number)) throw new Error("Quran page number must be between 1 and 604.");

  const cacheKey = `${pageCachePrefix}${number}`;
  const cached = window.localStorage.getItem(cacheKey);
  let cachedPage: QuranPage | null = null;
  if (cached) {
    try {
      const page = JSON.parse(cached) as QuranPage;
      if (isPageNumber(page.number) && page.number === number && Array.isArray(page.ayahs) && page.ayahs.length > 0) {
        cachedPage = { ...page, cached: true };
      } else {
        console.warn(`Ignoring invalid cached Quran page data for page ${number}.`);
      }
    } catch (reason) {
      console.warn(`Ignoring invalid cached Quran page data for page ${number}.`, reason);
    }
  }
  if (cachedPage) return cachedPage;

  const data = await requestJson<{ number: number; ayahs: QuranPageVerse[] }>(
    `${api}/page/${number}/quran-uthmani`,
  );
  if (!isPageNumber(data.number) || data.number !== number || !Array.isArray(data.ayahs) || data.ayahs.length === 0) {
    throw new Error("Quran text service returned an invalid page.");
  }
  const page = { number: data.number, ayahs: data.ayahs, cached: false };
  savePage(page);
  return page;
}
