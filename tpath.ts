import { IntlMessageFormat } from 'intl-messageformat';

/**
 * Creates a typed translation path builder.
 *
 * ```ts
 * const messages = { 'common.home.title': 'Home' };
 * const createT = tpath<{ common: { home: { title: 'Home' } } }>()
 *     .ctx<{ messages: typeof messages }>()
 *     .resolve((keys, ctx) => ctx.messages[keys.join('.')]);
 * const t = createT({ messages });
 *
 * t.common.home.title(); // "Home"
 * ```
 */
export function tpath<TNamespace>(): tpath.Builder<TNamespace> {
  return createTPathBuilder<TNamespace, {}, {}>({});
}

/**
 * The single runtime export for TPath.
 */
export namespace tpath {
  export type Context<TUserContext extends object = {}> = Readonly<TUserContext>;

  export interface ExtensionContext<TContext extends object = {}> {
    readonly ctx: Context<TContext>;
    readonly keys: readonly string[];
    readonly resolve: (keys: readonly string[]) => string | undefined;
    readonly translate: (keys: readonly string[], interpolation?: object) => string;
  }

  export type ExtensionMap<TContext extends object = {}> = Readonly<
    Record<`$${string}`, (context: ExtensionContext<TContext>, ...args: any[]) => unknown>
  >;

  export type TPath<TNamespace, TExtensions extends ExtensionMap<any>> = _TPath<
    TNamespace,
    TExtensions
  >;

  export interface Builder<
    TNamespace,
    TContext extends object = {},
    TExtensions extends ExtensionMap<any> = {},
  > {
    ctx<TNextContext extends object>(): Builder<TNamespace, TContext & TNextContext, TExtensions>;
    extend<TNextExtensions extends ExtensionMap<TContext>>(
      extensions: TNextExtensions,
    ): Builder<TNamespace, TContext, TExtensions & TNextExtensions>;
    resolve(
      resolveValue: (keys: readonly string[], ctx: Context<TContext>) => string | undefined,
    ): Factory<TNamespace, TContext, TExtensions>;
  }

  export type Factory<
    TNamespace,
    TContext extends object,
    TExtensions extends ExtensionMap<any>,
  > = [keyof TContext] extends [never]
    ? (ctx?: never) => TPath<TNamespace, TExtensions>
    : (ctx: Context<TContext>) => TPath<TNamespace, TExtensions>;

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

type _TPath<
  TNamespace,
  TExtensions extends tpath.ExtensionMap<any>,
> = ExtensionMethods<TExtensions> & {
  readonly [K in keyof TNamespace]: TNamespace[K] extends string
    ? TLeafFunction<TNamespace, K, TExtensions>
    : _TPath<TNamespace[K], TExtensions>;
};

function createTPathBuilder<
  TNamespace,
  TContext extends object,
  TExtensions extends tpath.ExtensionMap<any>,
>(extensions: TExtensions): tpath.Builder<TNamespace, TContext, TExtensions> {
  return {
    ctx<TNextContext extends object>() {
      return createTPathBuilder<TNamespace, TContext & TNextContext, TExtensions>(extensions);
    },
    extend<TNextExtensions extends tpath.ExtensionMap<TContext>>(nextExtensions: TNextExtensions) {
      return createTPathBuilder<TNamespace, TContext, TExtensions & TNextExtensions>({
        ...extensions,
        ...nextExtensions,
      });
    },
    resolve(resolveValue) {
      return ((ctx = {} as tpath.Context<TContext>) =>
        createTPathProxy<TNamespace, TContext, TExtensions>(
          resolveValue,
          extensions,
          [],
          ctx,
        )) as tpath.Factory<TNamespace, TContext, TExtensions>;
    },
  };
}

function createTPathProxy<
  TNamespace,
  TContext extends object,
  TExtensions extends tpath.ExtensionMap<any>,
>(
  resolveValue: (keys: readonly string[], ctx: tpath.Context<TContext>) => string | undefined,
  extensions: TExtensions,
  previousPath: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.TPath<TNamespace, TExtensions> {
  function resolve(keys: readonly string[]) {
    return resolveValue(keys, ctx);
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
            ((context: tpath.ExtensionContext<TContext>, ...args: unknown[]) => unknown) | undefined
          >
        >
      )[key];

      if (extension !== undefined) {
        return (...args: unknown[]) =>
          extension(
            {
              ctx,
              keys: previousPath,
              resolve,
              translate,
            },
            ...args,
          );
      }

      return createTPathProxy(resolveValue, extensions, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return translate(previousPath, argArray[0] as object | undefined);
    },
  }) as unknown as tpath.TPath<TNamespace, TExtensions>;
}
