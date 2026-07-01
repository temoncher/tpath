import { IntlMessageFormat } from 'intl-messageformat';

/**
 * Creates a typed translation path proxy.
 *
 * ```ts
 * const messages = { 'common.home.title': 'Home' };
 * const t = tpath<{ common: { home: { title: 'Home' } } }>((keys) => messages[keys.join('.')]);
 *
 * t.common.home.title(); // "Home"
 * ```
 */
export function tpath<TNamespace>(
  lookup: tpath.Lookup,
  options: tpath.Options = {},
): tpath.Proxy<TNamespace> {
  return createTPathProxy<TNamespace>(lookup, [], options);
}

/**
 * The single runtime export for TPath.
 */
export namespace tpath {
  export type Lookup = (keys: readonly string[]) => string | undefined;

  export interface Options {
    readonly debug?: () => boolean;
  }

  export type Proxy<TNamespace> = TProxy<TNamespace>;

  export type PickNs<TNamespaces, Ns> = Ns extends
    | [infer F extends keyof TNamespaces, ...infer R]
    | readonly [infer F extends keyof TNamespaces, ...infer R]
    ? Prettify<{ readonly [K in F]: TNamespaces[F] } & PickNs<TNamespaces, R>>
    : unknown;
}

export default tpath;

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
  R extends string = '',
> = S extends `${infer TBeforeClosing}}${infer TAfterClosing}`
  ? S extends `${infer TBeforeOpening}{${infer TAfterOpening}`
    ? TBeforeOpening extends `${TBeforeClosing}${string}`
      ? TStack['length'] extends 0
        ? `${R}${TBeforeClosing}`
        : TStack extends [...infer TStart, infer _]
          ? AccumulateBeforeClosing<TAfterClosing, TStart, `${R}${TBeforeClosing}}`>
          : never
      : AccumulateBeforeClosing<TAfterOpening, [...TStack, undefined], `${R}${TBeforeOpening}{`>
    : TStack['length'] extends 0
      ? `${R}${TBeforeClosing}`
      : TStack extends [...infer TStart, infer _]
        ? AccumulateBeforeClosing<TAfterClosing, TStart, `${R}${TBeforeClosing}}`>
        : never
  : `${R}${S}`;
type ICUTypes = 'number' | 'number, currency' | 'date' | 'time';
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

type Prettify<T> = { [K in keyof T]: T[K] } & {};
type InterpolationValues<S extends string> = Readonly<
  Record<GetInterpolationKeys<S>, string | number>
>;
type TFunctionParams<TNamespace, TKey extends keyof TNamespace> = TNamespace[TKey] extends string
  ? TNamespace[TKey] extends `${string}{${string}}${string}`
    ? [interpolation: InterpolationValues<TNamespace[TKey]>]
    : []
  : never;

interface UnsafeTFunction {
  /**
   * Dynamic translation lookup for keys that are not known at compile time.
   */
  $: (key: string | number, interpolation?: object) => string;
  /**
   * Checks if a dynamic translation exists.
   */
  $exists: (key?: string | number) => boolean;
}

interface TLeafUnsafeFunction {
  /**
   * Checks if this translation exists.
   */
  $exists: () => boolean;
}

type TLeafFunction<TNamespace, K extends keyof TNamespace> = TLeafUnsafeFunction &
  ((...params: TFunctionParams<TNamespace, K>) => string);

type TProxy<TNamespace> = UnsafeTFunction & {
  readonly [K in keyof TNamespace]: TNamespace[K] extends string
    ? TLeafFunction<TNamespace, K>
    : TProxy<TNamespace[K]>;
};

function createTPathProxy<TNamespace>(
  lookup: tpath.Lookup,
  previousPath: readonly string[],
  options: tpath.Options,
): tpath.Proxy<TNamespace> {
  function translationExists(...argArray: unknown[]) {
    const keys = collectKeys(previousPath, parseArgs(argArray).argsKey);

    return lookup(keys) !== undefined;
  }

  function processTranslation(...argArray: unknown[]) {
    const { argsKey, interpolation } = parseArgs(argArray);
    const keys = collectKeys(previousPath, argsKey);
    const key = keys.join('.');

    if (options.debug?.()) {
      return key;
    }

    const translation = lookup(keys);

    if (translation === undefined) {
      return key;
    }

    try {
      return new IntlMessageFormat(translation, undefined, undefined, { ignoreTag: true }).format(
        interpolation as any,
      ) as string;
    } catch (error) {
      console.error(`ICU formatting error: ${String(error)}`);

      return key;
    }
  }

  return new Proxy(() => undefined, {
    get(_target, key) {
      if (typeof key === 'symbol') {
        throw new TypeError(
          'Using Symbol as a key is not supported, as the proxy only works with strings.',
        );
      }

      if (key === '$') {
        return processTranslation;
      }

      if (key === '$exists') {
        return translationExists;
      }

      return createTPathProxy(lookup, [...previousPath, key], options);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return processTranslation(...argArray);
    },
  }) as unknown as tpath.Proxy<TNamespace>;
}

function parseArgs([firstArg, secondArg]: readonly unknown[]) {
  if (typeof firstArg === 'string' || typeof firstArg === 'number') {
    return { argsKey: firstArg.toString(), interpolation: secondArg };
  }

  return { interpolation: firstArg };
}

function collectKeys(
  previousPath: readonly string[],
  argsKey: string | undefined,
): readonly string[] {
  if (argsKey === undefined) {
    return previousPath;
  }

  return [...previousPath, argsKey];
}
