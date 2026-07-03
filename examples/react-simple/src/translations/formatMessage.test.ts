import { describe, expect, test } from "vitest";

import { formatMessage } from "./formatMessage";

describe("formatMessage", () => {
  test("replaces named placeholders", () => {
    expect(formatMessage("{index}. {text}", { index: 2, text: "Ship docs" })).toBe("2. Ship docs");
  });

  test("formats the simple one/other plural shape used by the demo", () => {
    expect(formatMessage("{count, plural, one {# note} other {# notes}}", { count: 1 })).toBe(
      "1 note",
    );
    expect(formatMessage("{count, plural, one {# note} other {# notes}}", { count: 2 })).toBe(
      "2 notes",
    );
  });
});
