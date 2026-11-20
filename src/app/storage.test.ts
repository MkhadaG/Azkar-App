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
