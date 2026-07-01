import { IntlMessageFormat } from 'intl-messageformat';

/**
 * Creates a typed translation path proxy.
 *
 * ```ts
 * const messages = { 'common.home.title': 'Home' };
 * const t = tpath((keys: tpath.Keys<{ common: { home: { title: 'Home' } } }>) => {
 *     return messages[keys.join('.')];
 * });
 *
 * t.common.home.title(); // "Home"
 * ```
 */
export function tpath<TNamespace>(
  resolveValue: (keys: tpath.Keys<TNamespace>, options: tpath.Options) => string | undefined,
): tpath.Proxy<TNamespace, {}>;
export function tpath<
  TNamespace,
  TOptions extends object,
  TExtensions extends tpath.ExtensionMap<TOptions>,
>(
  resolveValue: (
    keys: tpath.Keys<TNamespace>,
    options: tpath.Options<TOptions>,
  ) => string | undefined,
  extensions: TExtensions,
  options?: tpath.Options<TOptions>,
): tpath.Proxy<TNamespace, TExtensions>;
export function tpath<
  TNamespace,
  TOptions extends object,
  TExtensions extends tpath.ExtensionMap<TOptions>,
>(
  resolveValue: (
    keys: tpath.Keys<TNamespace>,
    options: tpath.Options<TOptions>,
  ) => string | undefined,
  extensions = {} as TExtensions,
  options = {} as tpath.Options<TOptions>,
): tpath.Proxy<TNamespace, TExtensions> {
  return createTPathProxy<TNamespace, TOptions, TExtensions>(resolveValue, extensions, [], options);
}

/**
 * The single runtime export for TPath.
 */
export namespace tpath {
  export type Keys<TNamespace> = readonly string[] & {
    readonly [__tpathKeysTypes]: TNamespace;
  };

  export type Options<TUserOptions extends object = {}> = Readonly<TUserOptions>;

  export interface ExtensionContext<TOptions extends object = {}> {
    readonly keys: readonly string[];
    readonly options: Options<TOptions>;
    readonly resolve: (keys: readonly string[]) => string | undefined;
    readonly translate: (keys: readonly string[], interpolation?: object) => string;
  }

  export type ExtensionMap<TOptions extends object = {}> = Readonly<
    Record<`$${string}`, (context: ExtensionContext<TOptions>, ...args: any[]) => unknown>
  >;

  export type Proxy<TNamespace, TExtensions extends ExtensionMap<any>> = TProxy<
    TNamespace,
    TExtensions
  >;

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

type StripContext<T> = T extends (
  context: tpath.ExtensionContext<any>,
  ...args: infer TArgs
) => infer R
  ? (...args: TArgs) => R
  : never;

type ExtensionMethods<TExtensions extends tpath.ExtensionMap<any>> = {
  readonly [K in keyof TExtensions]: StripContext<TExtensions[K]>;
};

type TLeafFunction<
  TNamespace,
  K extends keyof TNamespace,
  TExtensions extends tpath.ExtensionMap<any>,
> = ExtensionMethods<TExtensions> & ((...params: TFunctionParams<TNamespace, K>) => string);

type TProxy<
  TNamespace,
  TExtensions extends tpath.ExtensionMap<any>,
> = ExtensionMethods<TExtensions> & {
  readonly [K in keyof TNamespace]: TNamespace[K] extends string
    ? TLeafFunction<TNamespace, K, TExtensions>
    : TProxy<TNamespace[K], TExtensions>;
};

// Phantom type channel used by `tpath.Keys`. No runtime property with this
// key is ever written to key arrays.
declare const __tpathKeysTypes: unique symbol;

function createTPathProxy<
  TNamespace,
  TOptions extends object,
  TExtensions extends tpath.ExtensionMap<TOptions>,
>(
  resolveValue: (
    keys: tpath.Keys<TNamespace>,
    options: tpath.Options<TOptions>,
  ) => string | undefined,
  extensions: TExtensions,
  previousPath: readonly string[],
  options: tpath.Options<TOptions>,
): tpath.Proxy<TNamespace, TExtensions> {
  function resolve(keys: readonly string[]) {
    return resolveValue(keys as tpath.Keys<TNamespace>, options);
  }

  function translate(keys: readonly string[], interpolation?: object) {
    const key = keys.join('.');
    const translation = resolve(keys);

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

      const extension = (
        extensions as Readonly<
          Record<
            string,
            ((context: tpath.ExtensionContext<TOptions>, ...args: unknown[]) => unknown) | undefined
          >
        >
      )[key];

      if (extension !== undefined) {
        return (...args: unknown[]) =>
          extension(
            {
              keys: previousPath,
              options,
              resolve,
              translate,
            },
            ...args,
          );
      }

      return createTPathProxy(resolveValue, extensions, [...previousPath, key], options);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return translate(previousPath, argArray[0] as object | undefined);
    },
  }) as unknown as tpath.Proxy<TNamespace, TExtensions>;
}
