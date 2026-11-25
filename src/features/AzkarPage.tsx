import { useMemo, useState, type CSSProperties } from "react";
import type { AppState } from "../app/model";
import { Icon } from "../components/Icon";
import { openExternal } from "../app/desktop";
import {
  adhkar,
  getActiveDhikr,
  getCompletedDhikrCount,
  getDhikrProgressKey,
  type AdhkarCategory,
} from "../services/adhkar";

const categories: { id: AdhkarCategory; ar: string; en: string; icon: "sun" | "moon" | "circle" }[] = [
  { id: "morning", ar: "الصباح", en: "Morning", icon: "sun" },
  { id: "evening", ar: "المساء", en: "Evening", icon: "moon" },
  { id: "after-prayer", ar: "بعد الصلاة", en: "After prayer", icon: "circle" },
  { id: "sleeping", ar: "النوم", en: "Before sleep", icon: "moon" },
  { id: "waking", ar: "الاستيقاظ", en: "On waking", icon: "sun" },
];

interface AzkarPageProps {
  state: AppState;
  onChange: (update: (state: AppState) => AppState) => void;
}

export function AzkarPage({ state, onChange }: AzkarPageProps) {
  const { language } = state.preferences;
  const ar = language === "ar";
  const [category, setCategory] = useState<AdhkarCategory>("morning");
  const items = useMemo(() => adhkar.filter((item) => item.category.includes(category)), [category]);
  const counts = useMemo(
    () => Object.fromEntries(items.map((item) => [
      item.id,
      state.adhkarCounts[getDhikrProgressKey(category, item.id)]
        ?? (category === "morning" ? state.adhkarCounts[item.id] ?? 0 : 0),
    ])),
    [category, items, state.adhkarCounts],
  );
  const completed = getCompletedDhikrCount(items, counts);
  const activeItem = getActiveDhikr(items, counts);
  const activeIndex = activeItem ? items.indexOf(activeItem) : items.length;
  const percent = items.length === 0 ? 0 : Math.round((completed / items.length) * 100);
  const numbers = new Intl.NumberFormat(ar ? "ar" : "en");

  function increment(itemId: string, repeat: number) {
    onChange((current) => {
      const key = getDhikrProgressKey(category, itemId);
      const value = current.adhkarCounts[key] ?? (category === "morning" ? current.adhkarCounts[itemId] ?? 0 : 0);
      return { ...current, adhkarCounts: { ...current.adhkarCounts, [key]: Math.min(repeat, value + 1) } };
    });
  }

  function reset(itemId: string) {
    onChange((current) => ({
      ...current,
      adhkarCounts: { ...current.adhkarCounts, [getDhikrProgressKey(category, itemId)]: 0 },
    }));
  }

  function restartCategory() {
    onChange((current) => ({
      ...current,
      adhkarCounts: {
        ...current.adhkarCounts,
        ...Object.fromEntries(items.map((item) => [getDhikrProgressKey(category, item.id), 0])),
      },
    }));
  }

  return (
    <div className="page azkar-page">
      <section className="card azkar-head">
        <div>
          <span className="eyebrow">{ar ? "أذكار موثّقة بمصادرها" : "Source-referenced adhkar"}</span>
          <h2>{ar ? "أذكار اليوم" : "Daily adhkar"}</h2>
          <p className="muted">
            {ar
              ? "أكمل الذكر واضغط زر الاحتساب للانتقال تلقائيًا إلى التالي. يُحفظ تقدّمك لكل فئة على هذا الجهاز."
              : "Complete each remembrance and count it to move on. Progress for each category is saved on this device."}
          </p>
        </div>
        <div className="ring" style={{ "--p": String(percent) } as CSSProperties} aria-label={`${completed} / ${items.length}`}>
          <div className="ring-inner">
            <strong>{numbers.format(completed)}</strong>
            <span>/ {numbers.format(items.length)}</span>
          </div>
        </div>
      </section>

      <div className="seg seg-scroll" role="tablist" aria-label={ar ? "أوقات الأذكار" : "Adhkar times"}>
        {categories.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            aria-selected={category === item.id}
            className={category === item.id ? "on" : ""}
            onClick={() => setCategory(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {ar ? item.ar : item.en}
          </button>
        ))}
      </div>

      {activeItem ? (
        <article className="card dhikr" key={activeItem.id} aria-live="polite">
          <div className="dhikr-head">
            <span className="badge" dir="ltr">{numbers.format(activeIndex + 1)} / {numbers.format(items.length)}</span>
            <span className="muted small">{activeItem.reference}</span>
          </div>
          <p className="dhikr-arabic" lang="ar" dir="rtl">{activeItem.arabic}</p>
          <p className="dhikr-meaning">{activeItem.meaning[language]}</p>
          <div className="dhikr-foot">
            <button type="button" className="btn btn-ghost" onClick={() => void openExternal(activeItem.sourceUrl)}>
              {ar ? "عرض المصدر" : "View source"}
              <Icon name="arrow" flip size={14} />
            </button>
            <div className="dhikr-counter">
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => reset(activeItem.id)} aria-label={ar ? "إعادة عدّ الذكر" : "Reset this count"}>
                <Icon name="rotate" size={18} />
              </button>
              <span className="count-pill" dir="ltr">
                {numbers.format(counts[activeItem.id] ?? 0)} / {numbers.format(activeItem.repeat)}
              </span>
              <button
                type="button"
                className="tap-btn"
                onClick={() => increment(activeItem.id, activeItem.repeat)}
                aria-label={ar ? "احتساب الذكر" : "Count this remembrance"}
              >
                <Icon name="check" size={22} />
              </button>
            </div>
          </div>
        </article>
      ) : (
        <section className="card complete-card" role="status">
          <span className="empty-icon"><Icon name="check" size={22} /></span>
          <h3>{ar ? "أتممت أذكار هذه الفئة" : "This set is complete"}</h3>
          <p className="muted">{ar ? "أحسنت، تقبّل الله منك." : "Well done. May Allah accept it from you."}</p>
          <button type="button" className="btn btn-outline" onClick={restartCategory}>
            {ar ? "ابدأ من جديد" : "Start again"}
          </button>
        </section>
      )}
    </div>
  );
}
