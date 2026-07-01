import { describe, expect, test } from "vitest";

import appEn from "../__translationMocks__/app.gen";
import dashboardEn from "../__translationMocks__/dashboard.gen";
import issuesEn from "../__translationMocks__/issues.gen";
import { flattenMessages } from "../test/flattenMessages";
import { createT } from "./createT";

describe("translation service", () => {
  test("creates flat dictionaries from generated mock translations", () => {
    expect(
      flattenMessages({
        app: {
          nav: {
            dashboard: "Overview",
          },
          title: "Repo Lens",
        },
        commits: {
          byAuthor: "{sha} by {author}",
        },
      }),
    ).toEqual({
      "app.nav.dashboard": "Overview",
      "app.title": "Repo Lens",
      "commits.byAuthor": "{sha} by {author}",
    });
  });

  test("supports id-based translations from server-owned ids", () => {
    const t = createT({
      errorNamespaces: new Map(),
      locale: "en",
      loadingNamespaces: new Set(),
      messages: { ...flattenMessages(issuesEn) },
    });

    expect(t.issues.status.$("open")).toBe("Open");
    expect(t.issues.status.$("needs-triage")).toBe("Needs triage");
  });

  test("marks translation namespaces as loading for shimmer placeholders", () => {
    const t = createT({
      errorNamespaces: new Map(),
      locale: "en",
      loadingNamespaces: new Set(["app"]),
      messages: { ...flattenMessages(appEn), ...flattenMessages(dashboardEn) },
    });

    expect(t.app.nav.dashboard.$loading()).toBe(true);
    expect(t.app.nav.commits.$loading()).toBe(true);
    expect(t.dashboard.stats.stars.$loading()).toBe(false);
  });

  test("returns extension-owned keys for test ids", () => {
    const t = createT({
      errorNamespaces: new Map(),
      locale: "en",
      loadingNamespaces: new Set(),
      messages: { ...flattenMessages(appEn) },
    });

    expect(t.app.nav.dashboard.$key()).toBe("app.nav.dashboard");
    expect(t.app.nav.$key("dashboard")).toBe("app.nav.dashboard");
  });

  test("marks translations as failed per namespace", () => {
    const t = createT({
      errorNamespaces: new Map([
        ["demo", "Translation request failed: 500"],
        ["issues", "Translation request failed: 404"],
      ]),
      locale: "en",
      loadingNamespaces: new Set(),
      messages: { ...flattenMessages(appEn) },
    });

    expect(t.demo.title.$error()).toBe("Translation request failed: 500");
    expect(t.demo.$error("title")).toBe("Translation request failed: 500");
    expect(t.issues.status.open.$error()).toBe("Translation request failed: 404");
    expect(t.app.title.$error()).toBeNull();
  });
});
