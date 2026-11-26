import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppState } from "../app/model";
import type { copy } from "../app/locale";
import { Icon } from "../components/Icon";
import {
  adjacentQuranPage,
  fetchQuranPage,
  fetchQuranPageNumber,
  fetchSurahList,
  type QuranPage as QuranPageData,
  type SurahInfo,
} from "../services/quran";

const TOTAL_PAGES = 604;
const pageImageUrl = (page: number) =>
  `https://raw.githubusercontent.com/tarekeldeeb/madina_images/w1024/w1024_page${String(page).padStart(3, "0")}.png`;

// Page images are transparent PNGs with black text, so they sit on a cream "paper" sheet.
const preloaded = new Map<number, HTMLImageElement>();
function preloadNeighbours(page: number) {
  const wanted = [page - 1, page + 1].filter((number) => number >= 1 && number <= TOTAL_PAGES);
  for (const key of [...preloaded.keys()]) if (!wanted.includes(key)) preloaded.delete(key);
  for (const number of wanted) {
    if (preloaded.has(number)) continue;
    const image = new Image();
    image.src = pageImageUrl(number);
    preloaded.set(number, image);
  }
}

interface QuranPageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
  onChange: (update: (state: AppState) => AppState) => void;
}

export function QuranPage({ state, text, onChange }: QuranPageProps) {
  const { language } = state.preferences;
  const ar = language === "ar";
  const page = state.quranPage;
  const [surahs, setSurahs] = useState<SurahInfo[]>([]);
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [failedKey, setFailedKey] = useState("");

  const imageKey = `${page}:${attempt}`;
  const imageStatus = failedKey === imageKey ? "error" : loadedKey === imageKey ? "ready" : "loading";

  useEffect(() => {
    let active = true;
    fetchSurahList()
      .then((items) => {
        if (active) setSurahs(items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the surah index.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.quranPage !== null) return;
    let active = true;
    setLoading(true);
    setError("");
    fetchQuranPageNumber(state.quranSurah, state.quranAyah)
      .then((found) => {
        if (active) onChange((current) => (current.quranPage === null ? { ...current, quranPage: found } : current));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not locate this passage.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state.quranPage, state.quranSurah, state.quranAyah, retryToken, onChange]);

  useEffect(() => {
    if (state.quranPage === null) return;
    let active = true;
    setLoading(true);
    setError("");
    fetchQuranPage(state.quranPage)
      .then((data) => {
        if (active) setPageData(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load this page.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state.quranPage, retryToken]);

  useEffect(() => {
    if (state.quranPage !== null) preloadNeighbours(state.quranPage);
  }, [state.quranPage]);

  // Keep the selected surah and ayah in sync with the page that is actually shown.
  useEffect(() => {
    const first = pageData?.ayahs[0];
    if (!first || pageData.number !== state.quranPage) return;
    const onPage = pageData.ayahs.some((ayah) => ayah.surah.number === state.quranSurah && ayah.numberInSurah === state.quranAyah);
    if (onPage) return;
    onChange((current) => (current.quranPage === pageData.number
      ? { ...current, quranSurah: first.surah.number, quranAyah: first.numberInSurah }
      : current));
  }, [pageData, state.quranPage, state.quranSurah, state.quranAyah, onChange]);

  function movePage(direction: "previous" | "next") {
    onChange((current) => {
      const next = current.quranPage === null ? null : adjacentQuranPage(current.quranPage, direction);
      return next === null ? current : { ...current, quranPage: next };
    });
    setShowSaved(false);
  }

  function chooseSurah(number: number, ayah = 1) {
    onChange((current) => ({ ...current, quranSurah: number, quranAyah: ayah, quranPage: null }));
    setShowSaved(false);
  }

  async function openFullscreen() {
    try {
      if (isTauri()) {
        await invoke("set_quran_fullscreen", { enabled: true });
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open full-screen reading mode.");
    }
  }

  async function closeFullscreen() {
    try {
      if (isTauri()) {
        await invoke("set_quran_fullscreen", { enabled: false });
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setFullscreen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not exit full-screen reading mode.");
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        void closeFullscreen();
        return;
      }
      if (showSaved || page === null || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return;
      // In Arabic (right-to-left) the next page is on the left, matching the on-screen buttons.
      const forward = ar ? "ArrowLeft" : "ArrowRight";
      const back = ar ? "ArrowRight" : "ArrowLeft";
      if (event.key === forward) {
        event.preventDefault();
        movePage("next");
      } else if (event.key === back) {
        event.preventDefault();
        movePage("previous");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const bookmarkKey = `${state.quranSurah}:${state.quranAyah}`;
  const bookmarked = state.quranBookmarks.includes(bookmarkKey);
  const pageLabel = page === null ? "—" : `${page} / ${TOTAL_PAGES}`;

  function toggleBookmark() {
    onChange((current) => ({
      ...current,
      quranBookmarks: current.quranBookmarks.includes(bookmarkKey)
        ? current.quranBookmarks.filter((item) => item !== bookmarkKey)
        : [...current.quranBookmarks, bookmarkKey],
    }));
  }

  const sheet = (expandable: boolean) => (
    <div className="mushaf-sheet">
      {page === null || imageStatus === "error" ? (
        <div className="mushaf-status" role={imageStatus === "error" ? "alert" : "status"}>
          <p>{imageStatus === "error"
            ? (ar ? "تعذّر تحميل صورة الصفحة. تحقق من اتصال الإنترنت." : "The page could not be loaded. Check your connection.")
            : text.loading}</p>
          {imageStatus === "error" && (
            <button type="button" className="btn btn-soft" onClick={() => setAttempt((value) => value + 1)}>
              {text.retry}
            </button>
          )}
        </div>
      ) : (
        <>
          {imageStatus === "loading" && <div className="mushaf-status" role="status">{text.loading}</div>}
          <img
            key={imageKey}
            className={`mushaf-image${imageStatus === "ready" ? " is-ready" : ""}`}
            src={pageImageUrl(page)}
            alt={ar ? `صفحة ${page} من المصحف` : `Mushaf page ${page}`}
            decoding="async"
            onLoad={() => setLoadedKey(imageKey)}
            onError={() => setFailedKey(imageKey)}
          />
        </>
      )}
      {expandable && imageStatus === "ready" && (
        <button
          type="button"
          className="mushaf-expand"
          onClick={() => void openFullscreen()}
          aria-label={ar ? "ملء الشاشة" : "Full screen"}
          title={ar ? "ملء الشاشة" : "Full screen"}
        >
          <Icon name="fullscreen" size={20} />
        </button>
      )}
    </div>
  );

  const previousButton = (
    <button type="button" className="btn btn-outline" onClick={() => movePage("previous")} disabled={page === null || page <= 1}>
      <Icon name="arrow" size={16} className="icon-mirror" />
      {ar ? "السابق" : "Previous"}
    </button>
  );
  const nextButton = (
    <button type="button" className="btn btn-outline" onClick={() => movePage("next")} disabled={page === null || page >= TOTAL_PAGES}>
      <Icon name="arrow" flip size={16} />
      {ar ? "التالي" : "Next"}
    </button>
  );

  return (
    <div className={`page quran-page${showSaved ? " is-saved" : ""}${error ? " has-error" : ""}`}>
      <section className="card quran-bar">
        <label className="field-inline">
          <span className="eyebrow">{ar ? "اختيار السورة" : "Go to surah"}</span>
          <select className="input" value={state.quranSurah} onChange={(event) => chooseSurah(Number(event.target.value))}>
            {surahs.map((surah) => (
              <option value={surah.number} key={surah.number}>
                {String(surah.number).padStart(3, "0")} · {surah.name} · {surah.englishName}
              </option>
            ))}
          </select>
        </label>
        <div className="quran-nav">
          {previousButton}
          <span className="page-indicator" dir="ltr">{pageLabel}</span>
          {nextButton}
        </div>
        <div className="quran-tools">
          <button
            type="button"
            className={`btn ${bookmarked ? "btn-soft" : "btn-outline"}`}
            onClick={toggleBookmark}
            aria-pressed={bookmarked}
            disabled={pageData?.number !== page}
          >
            <Icon name={bookmarked ? "bookmark" : "bookmarkOutline"} size={17} />
            {ar ? "حفظ الموضع" : "Save place"}
          </button>
          <button type="button" className={`btn ${showSaved ? "btn-soft" : "btn-ghost"}`} onClick={() => setShowSaved((value) => !value)} aria-pressed={showSaved}>
            {ar ? "المحفوظات" : "Saved"} · {state.quranBookmarks.length}
          </button>
        </div>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-soft" onClick={() => setRetryToken((value) => value + 1)}>{text.retry}</button>
        </div>
      )}

      {showSaved ? (
        <section className="card">
          <div className="card-head"><h2>{ar ? "مواضع القراءة المحفوظة" : "Saved reading positions"}</h2></div>
          {state.quranBookmarks.length === 0 ? (
            <p className="muted">{ar ? "لا توجد مواضع محفوظة بعد." : "No saved positions yet."}</p>
          ) : (
            <div className="list">
              {state.quranBookmarks.map((key) => {
                const [surahNumber, ayahNumber] = key.split(":").map(Number);
                const surah = surahs.find((item) => item.number === surahNumber);
                return (
                  <button type="button" className="list-row list-button" key={key} onClick={() => chooseSurah(surahNumber, ayahNumber)}>
                    <span className="list-title">{ar ? surah?.name : surah?.englishName} · {surahNumber}:{ayahNumber}</span>
                    <Icon name="arrow" flip size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="card reader">{sheet(true)}</section>
      )}

      {fullscreen && createPortal(
        <div className="mushaf-overlay" role="dialog" aria-modal="true" aria-label={ar ? "قارئ المصحف" : "Mushaf reader"}>
          <div className="mushaf-overlay-bar">
            <span className="page-indicator" dir="ltr">{pageLabel}</span>
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => void closeFullscreen()} aria-label={ar ? "إغلاق" : "Close"}>
              <Icon name="fullscreenExit" size={18} />
            </button>
          </div>
          <button
            type="button"
            className="mushaf-side-arrow is-left"
            onClick={() => movePage(ar ? "next" : "previous")}
            disabled={page === null || (ar ? page >= TOTAL_PAGES : page <= 1)}
            aria-label={ar ? "الصفحة التالية" : "Previous page"}
          >
            <Icon name="arrow" flip size={23} />
          </button>
          <div className="mushaf-overlay-body">{sheet(false)}</div>
          <button
            type="button"
            className="mushaf-side-arrow is-right"
            onClick={() => movePage(ar ? "previous" : "next")}
            disabled={page === null || (ar ? page <= 1 : page >= TOTAL_PAGES)}
            aria-label={ar ? "الصفحة السابقة" : "Next page"}
          >
            <Icon name="arrow" size={23} />
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
