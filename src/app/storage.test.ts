import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./model";
import { loadAppState } from "./storage";

function useLocalState(value: string) {
  vi.stubGlobal("window", {
    localStorage: { getItem: vi.fn(() => value) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tasbih goal persistence", () => {
  it("defaults older saved data to unlimited counting", async () => {
    const legacyState = JSON.parse(JSON.stringify(initialState)) as Record<string, unknown>;
    delete legacyState.tasbihGoalEnabled;
    delete legacyState.tasbihGoal;
    useLocalState(JSON.stringify(legacyState));

    await expect(loadAppState()).resolves.toMatchObject({
      tasbihGoalEnabled: false,
      tasbihGoal: 33,
    });
  });

  it("ignores legacy manual prayer-minute adjustments", async () => {
    useLocalState(JSON.stringify({
      ...initialState,
      preferences: {
        ...initialState.preferences,
        prayerAdjustments: { Fajr: 1, Dhuhr: -1, Asr: 0, Maghrib: 1, Isha: -1 },
      },
    }));

    const restored = await loadAppState();
    expect(restored.preferences).not.toHaveProperty("prayerAdjustments");
    expect(restored.preferences.calculationMethod).toBe(initialState.preferences.calculationMethod);
  });

  it("ignores obsolete taskbar widget options saved by older versions", async () => {
    useLocalState(JSON.stringify({
      ...initialState,
      preferences: {
        ...initialState.preferences,
        taskbarWidgetClickThrough: true,
        taskbarWidgetSize: "large",
      },
    }));

    const restored = await loadAppState();
    expect(restored.preferences).not.toHaveProperty("taskbarWidgetClickThrough");
    expect(restored.preferences).not.toHaveProperty("taskbarWidgetSize");
  });

  it("enables the taskbar widget by default for older uncustomized installs", async () => {
    const legacyState = JSON.parse(JSON.stringify(initialState)) as {
      preferences: Record<string, unknown>;
      [key: string]: unknown;
    };
    legacyState.preferences.taskbarWidgetEnabled = false;
    delete legacyState.preferences.taskbarWidgetCustomized;
    useLocalState(JSON.stringify(legacyState));

    await expect(loadAppState()).resolves.toMatchObject({
      preferences: { taskbarWidgetEnabled: true, taskbarWidgetCustomized: false },
    });
  });

  it("preserves an explicit taskbar widget preference", async () => {
    useLocalState(JSON.stringify({
      ...initialState,
      preferences: {
        ...initialState.preferences,
        taskbarWidgetEnabled: false,
        taskbarWidgetCustomized: true,
      },
    }));

    await expect(loadAppState()).resolves.toMatchObject({
      preferences: { taskbarWidgetEnabled: false, taskbarWidgetCustomized: true },
    });
  });

  it("restores a custom enabled goal", async () => {
    useLocalState(JSON.stringify({
      ...initialState,
      tasbihGoalEnabled: true,
      tasbihGoal: 250,
    }));

    await expect(loadAppState()).resolves.toMatchObject({
      tasbihGoalEnabled: true,
      tasbihGoal: 250,
    });
  });

  it("rejects an invalid saved goal", async () => {
    useLocalState(JSON.stringify({ ...initialState, tasbihGoal: 0 }));

    await expect(loadAppState()).rejects.toThrow("Saved tasbih goal is invalid.");
  });
});
