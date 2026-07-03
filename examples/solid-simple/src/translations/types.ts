/**
 * Keeps the same nested key shape as the source locale while widening every
 * leaf to `string`. tpath needs `typeof en` with literal leaves to infer
 * interpolation arguments, but runtime dictionaries like `ru` need to provide
 * different translated text at those same leaves.
 */
export type Messages<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Messages<T[K]>;
};

/**
 * Small translation adapter for the simple examples.
 *
 * It maps message leaves to callable tpath leaves and extracts interpolation
 * names from placeholders like `{name}` or `{count, plural, ...}`. Plural
 * branch placeholders such as `{# notes}` are ignored.
 */
export type TranslationPath<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? TranslationCall<T[K]>
    : T[K] extends object
      ? TranslationPath<T[K]>
      : never;
};

type TranslationCall<TMessage extends string> =
  InterpolationKey<TMessage> extends never
    ? () => string | undefined
    : (
        interpolation: Readonly<Record<InterpolationKey<TMessage>, string | number>>,
      ) => string | undefined;

type InterpolationKey<TMessage extends string> =
  TMessage extends `${string}{${infer TPlaceholder}}${infer TRest}`
    ? PlaceholderName<TPlaceholder> | InterpolationKey<TRest>
    : never;

type PlaceholderName<TPlaceholder extends string> =
  Trim<TPlaceholder> extends `#${string}`
    ? never
    : Trim<TPlaceholder> extends `${infer TName},${string}`
      ? Trim<TName>
      : Trim<TPlaceholder>;

type Trim<S extends string> = S extends
  | ` ${infer R}`
  | `${infer R} `
  | `\n${infer R}`
  | `${infer R}\n`
  ? Trim<R>
  : S;
