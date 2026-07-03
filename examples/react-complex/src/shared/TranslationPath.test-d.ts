import { assertType, test } from "vitest";

import type { TranslationPath } from "./TranslationPath";

interface Messages {
  readonly app: {
    readonly title: "Repo Lens";
    readonly greeting: "Hello, {name}!";
    readonly score: "{name} has {score, number} points";
    readonly count: "{count, plural, one {# issue} other {# issues}}";
    readonly ownerSummary: "{gender, select, female {{count, plural, one {She owns # repo} other {She owns # repos}}} other {They own {count, number} repos}}";
  };
}

test("maps message leaves to typed translation calls", () => {
  const t = {} as TranslationPath<Messages>;

  assertType<string | undefined>(t.app.title());
  assertType<string | undefined>(t.app.greeting({ name: "Ada" }));
  assertType<string | undefined>(t.app.score({ name: "Ada", score: 7 }));
  assertType<string | undefined>(t.app.count({ count: 2 }));
  assertType<string | undefined>(t.app.ownerSummary({ gender: "female", count: 2 }));

  // @ts-expect-error plain messages do not accept interpolation
  t.app.title({});

  // @ts-expect-error interpolation is required when the message declares placeholders
  t.app.greeting();

  // @ts-expect-error interpolation key is required
  t.app.score({ name: "Ada" });

  // @ts-expect-error interpolation values must be string or number
  t.app.count({ count: true });

  // @ts-expect-error missing nested key
  t.app.missing();
});
