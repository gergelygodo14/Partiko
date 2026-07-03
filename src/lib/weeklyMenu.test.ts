import { describe, expect, it } from "vitest";
import { DAY_NAMES, emptyDay, emptyWeek } from "@/lib/weeklyMenu";

describe("emptyDay", () => {
  it("returns blank strings and false flags", () => {
    expect(emptyDay()).toEqual({
      a: "",
      aGM: false,
      b: "",
      bGM: false,
      c: "",
      cGM: false,
    });
  });
});

describe("emptyWeek", () => {
  it("returns one empty day per day name", () => {
    const week = emptyWeek();
    expect(week).toHaveLength(DAY_NAMES.length);
    week.forEach((day) => expect(day).toEqual(emptyDay()));
  });

  it("returns independent day objects", () => {
    const week = emptyWeek();
    week[0].a = "Módosítva";
    expect(week[1].a).toBe("");
  });
});
