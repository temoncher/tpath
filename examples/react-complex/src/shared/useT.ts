import { useQueries } from "@tanstack/react-query";

import {
  createT,
  type Locale,
  type TranslationMessages,
  type TranslationNamespace,
} from "./createT";

export type LoadTranslations = (
  locale: Locale,
  namespace: TranslationNamespace,
) => Promise<TranslationMessages>;

export function useT(
  locale: Locale,
  namespaces: readonly TranslationNamespace[],
  loadTranslations: LoadTranslations,
) {
  const ctx = useQueries({
    queries: namespaces.map((namespace) => ({
      queryFn: () => loadTranslations(locale, namespace),
      queryKey: ["translations", locale, namespace],
    })),
    combine: (results) =>
      results.reduce(
        (ctx, query, index) => {
          const namespace = namespaces[index]!;

          if (query.data !== undefined) Object.assign(ctx.messages, query.data);

          if (query.isPending) ctx.loadingNamespaces.add(namespace);

          if (query.error !== null) ctx.errorNamespaces.set(namespace, query.error.message);

          return ctx;
        },
        {
          errorNamespaces: new Map<TranslationNamespace, string>(),
          locale,
          loadingNamespaces: new Set<TranslationNamespace>(),
          messages: {} as TranslationMessages,
        },
      ),
  });

  return createT(ctx);
}
