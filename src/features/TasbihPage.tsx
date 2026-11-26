import { useEffect, useState } from "react";
import type { AppState } from "../app/model";
import { openExternal } from "../app/desktop";
import { Icon } from "../components/Icon";

interface TasbihPageProps {
  state: AppState;
  onChange: (update: (state: AppState) => AppState) => void;
}

export function TasbihPage({ state, onChange }: TasbihPageProps) {
  const { language } = state.preferences;
  const ar = language === "ar";
  const [goalDraft, setGoalDraft] = useState(String(state.tasbihGoal));
  const [editingLabel, setEditingLabel] = useState(false);
  const goal = Number(goalDraft);
  const goalValid = Number.isSafeInteger(goal) && goal > 0;
  const count = state.tasbihCount;
  const progress = state.tasbihGoalEnabled && goalValid ? Math.min(100, (count / goal) * 100) : 0;
  const reached = state.tasbihGoalEnabled && goalValid && count >= goal;
  const numbers = (value: number) => value.toLocaleString(ar ? "ar" : "en");

  function increment() {
    onChange((current) => ({ ...current, tasbihCount: current.tasbihCount + 1 }));
  }

  function reset() {
    onChange((current) => ({ ...current, tasbihCount: 0 }));
  }

  function saveLabel(value: string) {
    onChange((current) => ({ ...current, tasbihLabel: value.trim() || current.tasbihLabel }));
    setEditingLabel(false);
  }

  function setGoalEnabled(enabled: boolean) {
    onChange((current) => ({ ...current, tasbihGoalEnabled: enabled }));
  }

  function updateGoal(value: string) {
    setGoalDraft(value);
    const next = Number(value);
    if (Number.isSafeInteger(next) && next > 0) onChange((current) => ({ ...current, tasbihGoal: next }));
  }

  // Space counts when nothing else is focused. Buttons handle Space natively, so they are skipped.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))) return;
      if (event.code === "Space") {
        event.preventDefault();
        increment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="page tasbih-page">
      <section className="card tasbih-card">
        <div className="tasbih-top">
          <div className="tasbih-label">
            <span className="eyebrow">{ar ? "ذِكْرُ اللَّهِ" : "Remembrance"}</span>
            {editingLabel ? (
              <input
                className="input tasbih-input"
                lang="ar"
                defaultValue={state.tasbihLabel}
                autoFocus
                aria-label={ar ? "تعديل الذكر" : "Edit dhikr"}
                onBlur={(event) => saveLabel(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveLabel(event.currentTarget.value);
                  if (event.key === "Escape") setEditingLabel(false);
                }}
              />
            ) : (
              <button type="button" className="label-btn" onClick={() => setEditingLabel(true)}>
                <span lang="ar">{state.tasbihLabel}</span>
                <Icon name="plus" size={14} />
              </button>
            )}
          </div>

          <div className="goal-controls">
            <button
              type="button"
              role="switch"
              aria-checked={state.tasbihGoalEnabled}
              className="switch"
              onClick={() => setGoalEnabled(!state.tasbihGoalEnabled)}
            />
            <span className="small">{ar ? "تحديد هدف" : "Set a goal"}</span>
            {state.tasbihGoalEnabled && (
              <input
                className="input goal-input"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={goalDraft}
                aria-label={ar ? "العدد المستهدف" : "Target count"}
                aria-invalid={!goalValid}
                onChange={(event) => updateGoal(event.currentTarget.value)}
                onBlur={() => {
                  if (!goalValid) setGoalDraft(String(state.tasbihGoal));
                }}
              />
            )}
          </div>
        </div>

        <button type="button" className="tasbih-dial" onClick={increment} aria-label={ar ? "زيادة العداد" : "Increase the count"}>
          <span className="tasbih-number">{numbers(count)}</span>
          <span className="tasbih-hint">{ar ? "اضغط أو اضغط مسافة" : "Tap or press Space"}</span>
        </button>

        <div className="tasbih-progress">
          {state.tasbihGoalEnabled ? (
            goalValid ? (
              <>
                <div className="row-between small">
                  <span className="muted">{ar ? "تقدم الورد" : "Goal progress"}</span>
                  <strong dir="ltr">{numbers(count)} / {numbers(goal)}</strong>
                </div>
                <div className="progress" role="progressbar" aria-label={ar ? "تقدم الهدف" : "Goal progress"} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(count, goal)}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : (
              <p className="notice notice-error" role="alert">
                {ar ? "أدخل عددًا صحيحًا أكبر من صفر." : "Enter a whole number greater than zero."}
              </p>
            )
          ) : (
            <p className="muted small">{ar ? "بلا حد — واصل التسبيح كما تشاء" : "No limit — keep counting as long as you like"}</p>
          )}

          <div className="tasbih-actions">
            <button type="button" className="btn btn-outline" onClick={reset}>
              <Icon name="rotate" size={16} />
              {ar ? "إعادة" : "Reset"}
            </button>
            {reached && (
              <span className="badge badge-gold">
                <Icon name="check" size={14} />
                {ar ? "اكتمل الهدف" : "Goal reached"}
              </span>
            )}
            <span className="muted small">{ar ? "يُحفظ تقدمك تلقائيًا على جهازك" : "Saved automatically on this device"}</span>
          </div>
        </div>
      </section>

      <section className="card quote-card">
        <Icon name="book" size={20} />
        <p>{ar ? "«مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الْحَيِّ وَالْمَيِّتِ»" : "“The example of one who remembers his Lord and one who does not is like that of the living and the dead.”"}</p>
        <button type="button" className="link-btn" onClick={() => void openExternal("https://sunnah.com/bukhari:6407")}>
          Sahih al-Bukhari 6407
        </button>
      </section>
    </div>
  );
}
