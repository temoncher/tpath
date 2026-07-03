import { IntlMessageFormat } from "intl-messageformat";

import { tpath } from "../../../../tpath.ts";
import type { TranslationPath } from "./TranslationPath";
import type appEn from "../__translationMocks__/app.gen.ts";
import type commitsEn from "../__translationMocks__/commits.gen.ts";
import type dashboardEn from "../__translationMocks__/dashboard.gen.ts";
import type demoEn from "../__translationMocks__/demo.gen.ts";
import type issuesEn from "../__translationMocks__/issues.gen.ts";

export type Translations = typeof appEn &
  typeof dashboardEn &
  typeof commitsEn &
  typeof issuesEn &
  typeof demoEn;
export type Locale = "en" | "ru";
export type TranslationNamespace = keyof Translations;

export type PartialMessages<T> = {
  readonly [K in keyof T]?: T[K] extends string ? string : PartialMessages<T[K]>;
};
export type FlatMessages = Readonly<Record<string, string>>;
export type TranslationMessages = FlatMessages;

interface TranslationContext {
  readonly errorNamespaces: ReadonlyMap<TranslationNamespace, string>;
  readonly locale: Locale;
  readonly loadingNamespaces: ReadonlySet<TranslationNamespace>;
  readonly messages: TranslationMessages;
}

export const createT = tpath<TranslationPath<Translations>, TranslationContext>().define(
  (ctx, keys, interpolation) => {
    const message = ctx.messages[keys.join(".")];

    if (message === undefined) {
      return undefined;
    }

    return new IntlMessageFormat(message, ctx.locale, undefined, { ignoreTag: true }).format(
      interpolation as any,
    ) as string;
  },
  {
    /**
     * Returns this translation path as a stable key for test ids and other metadata.
     */
    $key(ctx, key?: string) {
      return (key === undefined ? ctx.keys : [...ctx.keys, key]).join(".");
    },
    /**
     * Resolves a runtime-provided key segment under the current translation path.
     * Use it when the final key segment comes from fetched data instead of static code.
     */
    $(ctx, id: string, interpolation?: object) {
      return ctx.resolve([...ctx.keys, id], interpolation) as string | undefined;
    },
    /**
     * Returns this path's namespace-level loading error, if loading failed.
     */
    $error(ctx, key?: string) {
      return ctx.errorNamespaces.get(namespaceForKey(ctx.$key(key))) ?? null;
    },
    /**
     * Reports whether this path's translation namespace is still loading.
     */
    $loading(ctx, key?: string) {
      return ctx.loadingNamespaces.has(namespaceForKey(ctx.$key(key)));
    },
  },
);

function namespaceForKey(key: string): TranslationNamespace {
  return key.split(".", 1)[0] as TranslationNamespace;
}
