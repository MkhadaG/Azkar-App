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

  it("defaults the optional taskbar widget to off for existing installs", async () => {
    const legacyState = JSON.parse(JSON.stringify(initialState)) as {
      preferences: Record<string, unknown>;
      [key: string]: unknown;
    };
    delete legacyState.preferences.taskbarWidgetEnabled;
    useLocalState(JSON.stringify(legacyState));

    await expect(loadAppState()).resolves.toMatchObject({
      preferences: { taskbarWidgetEnabled: false },
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
