import { useMemo } from "react";
import type { AppState } from "../app/model";
import type { copy } from "../app/locale";
import { Icon } from "../components/Icon";

const islamicEvents = [
  { day: 1, month: 1, ar: "رأس السنة الهجرية", en: "Islamic New Year" },
  { day: 10, month: 1, ar: "يوم عاشوراء", en: "Day of Ashura" },
  { day: 1, month: 9, ar: "بداية رمضان", en: "Ramadan begins" },
  { day: 1, month: 10, ar: "عيد الفطر", en: "Eid al-Fitr" },
  { day: 9, month: 12, ar: "يوم عرفة", en: "Day of Arafah" },
  { day: 10, month: 12, ar: "عيد الأضحى", en: "Eid al-Adha" },
];

interface CalendarPageProps {
  state: AppState;
  text: (typeof copy)["ar"] | (typeof copy)["en"];
}

export function CalendarPage({ state, text }: CalendarPageProps) {
  const { language, location } = state.preferences;
  const ar = language === "ar";
  const timezone = location?.timezone;
  const today = new Date();
  const dayKey = today.toDateString();

  // One formatter per language/timezone, reused for every date below.
  const hijriParts = useMemo(
    () => new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: timezone }),
    [timezone],
  );
  const hijriMonth = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", { month: "long", timeZone: timezone }),
    [ar, timezone],
  );
  const eventDate = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar" : "en", { day: "numeric", month: "long", timeZone: timezone }),
    [ar, timezone],
  );
  const shortMonth = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", { month: "short", timeZone: timezone }),
    [ar, timezone],
  );
  const gregorian = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar" : "en", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone }),
    [ar, timezone],
  );
  const numbers = new Intl.NumberFormat(ar ? "ar" : "en");

  const current = useMemo(() => {
    const parts = hijriParts.formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    return { day: values.day, year: values.year };
  }, [hijriParts, dayKey]);

  const upcoming = useMemo(() => {
    const matches: { name: string; date: Date; day: number }[] = [];
    for (let offset = 0; offset < 370 && matches.length < 6; offset += 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + offset);
      const values = Object.fromEntries(hijriParts.formatToParts(date).map((part) => [part.type, Number(part.value)]));
      const event = islamicEvents.find((item) => item.day === values.day && item.month === values.month);
      if (event) matches.push({ name: ar ? event.ar : event.en, date, day: values.day });
    }
    return matches;
  }, [hijriParts, ar, dayKey]);

  return (
    <div className="page calendar-page">
      <section className="card card-hero calendar-hero">
        <div>
          <span className="eyebrow">{ar ? "تقويم أم القرى" : "Umm al-Qura calendar"}</span>
          <h2>{hijriMonth.format(today)}</h2>
          <p className="lead">{gregorian.format(today)}</p>
        </div>
        <div className="hijri-day">
          <strong>{numbers.format(current.day)}</strong>
          <span>{ar ? `${numbers.format(current.year)} هـ` : `AH ${numbers.format(current.year)}`}</span>
          <span className="badge">{text.today}</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">{ar ? "المناسبات الهجرية القادمة" : "Upcoming Hijri dates"}</span>
            <h2>{ar ? "المناسبات" : "Observances"}</h2>
          </div>
        </div>
        <div className="list">
          {upcoming.map((event, index) => (
            <div className="list-row" key={`${event.name}-${index}`}>
              <span className="date-badge">
                <strong>{numbers.format(event.day)}</strong>
                <small>{shortMonth.format(event.date)}</small>
              </span>
              <span className="grow">
                <strong className="block">{event.name}</strong>
                <small className="muted">{eventDate.format(event.date)}</small>
              </span>
              <Icon name="calendar" size={18} className="muted" />
            </div>
          ))}
        </div>
        <p className="muted small footnote">
          {ar
            ? "التواريخ تقديرية وفق تقويم أم القرى، وقد تختلف بحسب رؤية الهلال المحلية."
            : "Dates follow the Umm al-Qura calendar and may vary with local moon sighting."}
        </p>
      </section>
    </div>
  );
}
