/**
 * Converts a nested translation message tree into a tpath-compatible call tree.
 *
 * String leaves become functions that return `string | undefined`. ICU
 * MessageFormat-shaped string literals infer their required interpolation
 * values, while runtime parsing and lookup stay caller-owned.
 */
export type TranslationPath<TMessages> = {
  readonly [K in keyof TMessages]: TMessages[K] extends string
    ? TranslationCall<TMessages[K]>
    : TMessages[K] extends object
      ? TranslationPath<TMessages[K]>
      : never;
};

/**
 * Callable translation leaf produced for one message string.
 */
type TranslationCall<TMessage extends string> = (
  ...params: TranslationParams<TMessage>
) => string | undefined;

/**
 * Public call parameters inferred from one message string.
 */
type TranslationParams<TMessage extends string> = TMessage extends `${string}{${string}}${string}`
  ? [interpolation: InterpolationValues<TMessage>]
  : [];

/**
 * Interpolation object inferred from ICU MessageFormat-shaped placeholders.
 */
type InterpolationValues<S extends string> = Readonly<
  Record<GetInterpolationKeys<S>, string | number>
>;

type Trim<S extends string> = S extends
  | ` ${infer R}`
  | `${infer R} `
  | `\n${infer R}`
  | `${infer R}\n`
  ? Trim<R>
  : S;

type AccumulateBeforeClosing<
  S extends string,
  TStack extends unknown[] = [],
  R extends string = "",
> = S extends `${infer TBeforeClosing}}${infer TAfterClosing}`
  ? S extends `${infer TBeforeOpening}{${infer TAfterOpening}`
    ? TBeforeOpening extends `${TBeforeClosing}${string}`
      ? TStack["length"] extends 0
        ? `${R}${TBeforeClosing}`
        : TStack extends [...infer TStart, infer _]
          ? AccumulateBeforeClosing<TAfterClosing, TStart, `${R}${TBeforeClosing}}`>
          : never
      : AccumulateBeforeClosing<TAfterOpening, [...TStack, undefined], `${R}${TBeforeOpening}{`>
    : TStack["length"] extends 0
      ? `${R}${TBeforeClosing}`
      : TStack extends [...infer TStart, infer _]
        ? AccumulateBeforeClosing<TAfterClosing, TStart, `${R}${TBeforeClosing}}`>
        : never
  : `${R}${S}`;

type ICUTypes = "number" | "number, currency" | "date" | "time";

type DetectICU<S extends string> = S extends `${infer TIdentifier}, ${ICUTypes}`
  ? TIdentifier
  : S extends `${infer TSelectIdentifier}, select,${infer RestSelect}`
    ? S extends `${infer TPluralIdentifier}, plural,${infer RestPlural}`
      ? (
          TSelectIdentifier extends `${TPluralIdentifier}${string}`
            ? [TPluralIdentifier, RestPlural]
            : [TSelectIdentifier, RestSelect]
        ) extends [infer TIdentifier, infer Rest extends string]
        ? TIdentifier | GetInterpolationKeys<ParseOneLevelOfInterpolation<Rest>>
        : never
      : TSelectIdentifier | GetInterpolationKeys<ParseOneLevelOfInterpolation<RestSelect>>
    : S extends `${infer TPluralIdentifier}, plural,${infer RestPlural}`
      ? TPluralIdentifier | GetInterpolationKeys<ParseOneLevelOfInterpolation<RestPlural>>
      : S;

type ParseOneLevelOfInterpolation<S extends string> = S extends `${string}{${infer TAfterOpening}`
  ? AccumulateBeforeClosing<TAfterOpening> extends infer TInside extends string
    ? TAfterOpening extends `${TInside}}${infer TAfterClosing}`
      ? Trim<TInside> extends infer TTrimmedInside extends string
        ? TTrimmedInside | ParseOneLevelOfInterpolation<TAfterClosing>
        : never
      : never
    : never
  : never;

type GetInterpolationKeys<S extends string> = DetectICU<ParseOneLevelOfInterpolation<S>>;
