import { IntlMessageFormat } from "intl-messageformat";

import { tpath } from "../../../../tpath.ts";
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

export const createT = tpath<Translations>()
  .ctx<TranslationContext>()
  .extend({
    /**
     * Resolves a runtime-provided child id under the current translation path.
     * Use it when the final key segment comes from fetched data instead of static code.
     */
    $({ format, keys }, id: string, interpolation?: object) {
      return format([...keys, id], interpolation);
    },
    /**
     * Returns this translation path as a stable key for test ids and other metadata.
     */
    $key({ keys }, child?: string) {
      return joinKeys(child === undefined ? keys : [...keys, child]);
    },
    /**
     * Returns this path's namespace-level loading error, if loading failed.
     */
    $error({ ctx, keys }, child?: string) {
      return (
        ctx.errorNamespaces.get(namespaceForPath(child === undefined ? keys : [...keys, child])) ??
        null
      );
    },
    /**
     * Reports whether this path's translation namespace is still loading.
     */
    $loading({ ctx, keys }, child?: string) {
      return ctx.loadingNamespaces.has(
        namespaceForPath(child === undefined ? keys : [...keys, child]),
      );
    },
  })
  .format(({ ctx, interpolation, keys }) => {
    const message = ctx.messages[joinKeys(keys)];

    if (message === undefined) {
      return undefined;
    }

    return new IntlMessageFormat(message, ctx.locale, undefined, { ignoreTag: true }).format(
      interpolation as any,
    ) as string;
  });

function joinKeys(keys: readonly string[]) {
  return keys.join(".");
}

function namespaceForPath(keys: readonly string[]): TranslationNamespace {
  return keys[0] as TranslationNamespace;
}
