import { describe, expect, it } from "vitest";
import {
  adhkar,
  getActiveDhikr,
  getCompletedDhikrCount,
  getDhikrProgressKey,
  type AdhkarCategory,
} from "./adhkar";

describe("adhkar progress", () => {
  it("advances to the first remembrance that has not reached its repeat count", () => {
    const items = adhkar.filter((item) => item.category.includes("morning"));
    const counts = Object.fromEntries(items.map((item) => [item.id, item.repeat]));
    counts[items[2].id] = items[2].repeat - 1;

    expect(getActiveDhikr(items, counts)?.id).toBe(items[2].id);
  });

  it("counts completed items, not individual repetitions", () => {
    const items = adhkar.filter((item) => item.category.includes("after-prayer"));
    const counts = Object.fromEntries(items.map((item) => [item.id, item.repeat]));
    counts[items[0].id] = items[0].repeat - 1;

    expect(getCompletedDhikrCount(items, counts)).toBe(items.length - 1);
    expect(getActiveDhikr(items, counts)?.id).toBe(items[0].id);
  });

  it("keeps progress separate when a remembrance appears in multiple categories", () => {
    expect(getDhikrProgressKey("morning", "sayyid-al-istighfar"))
      .not.toBe(getDhikrProgressKey("evening", "sayyid-al-istighfar"));
  });

  it("provides source-linked remembrances for every requested category", () => {
    const categories: AdhkarCategory[] = ["morning", "evening", "after-prayer", "sleeping", "waking"];

    for (const category of categories) {
      const items = adhkar.filter((item) => item.category.includes(category));
      expect(items.length, category).toBeGreaterThan(1);
      expect(items.every((item) => item.repeat > 0 && item.sourceUrl.startsWith("https://")), category).toBe(true);
    }

    expect(new Set(adhkar.map((item) => item.id)).size).toBe(adhkar.length);
  });
});
