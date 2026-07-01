/**
 * Creates a typed translation path builder for a translation tree.
 *
 * The builder collects property names into a path and delegates every runtime
 * lookup, fallback, interpolation, and error policy to the formatter passed to
 * {@link tpath.Builder.format}.
 *
 * ```ts
 * const messages = { 'common.home.title': 'Home' };
 * const createT = tpath<{ common: { home: { title: 'Home' } } }>()
 *     .ctx<{ messages: typeof messages }>()
 *     .format(({ keys, ctx }) => ctx.messages[keys.join('.')]);
 * const t = createT({ messages });
 *
 * t.common.home.title(); // "Home"
 * ```
 */
export function tpath<TNamespace>(): tpath.Builder<TNamespace> {
  return createTPathBuilder<TNamespace, {}, {}>({});
}

/**
 * Public types that describe TPath builders, factories, translators, and
 * extension callbacks.
 */
export namespace tpath {
  /**
   * Immutable user context bound when a translator factory is called.
   *
   * ```ts
   * type TContext = tpath.Context<{ locale: string }>;
   * ```
   */
  export type Context<TUserContext extends object = {}> = Readonly<TUserContext>;

  /**
   * Data passed as the first argument to every extension method.
   */
  export interface ExtensionContext<TContext extends object = {}> {
    /**
     * The context object passed to the translator factory.
     */
    readonly ctx: Context<TContext>;
    /**
     * Formats an explicit path from inside an extension.
     *
     * ```ts
     * const extensions = {
     *   $({ format, keys }: tpath.ExtensionContext, child: string) {
     *     return format([...keys, child]);
     *   },
     * };
     * ```
     */
    readonly format: (keys: readonly string[], interpolation?: object) => string | undefined;
    /**
     * The collected path at the extension call site.
     */
    readonly keys: readonly string[];
  }

  /**
   * Data passed to the formatter when a translated leaf is invoked.
   */
  export interface FormatContext<TContext extends object = {}> {
    /**
     * The context object passed to the translator factory.
     */
    readonly ctx: Context<TContext>;
    /**
     * Interpolation values from the leaf call, or `undefined` when the message
     * type does not require interpolation.
     */
    readonly interpolation: object | undefined;
    /**
     * The collected translation path.
     */
    readonly keys: readonly string[];
  }

  /**
   * Formatter callback used by {@link Builder.format}.
   *
   * Return the translated string, or `undefined` when your lookup policy has no
   * value for the path. Thrown errors are left for the caller to handle.
   *
   * ```ts
   * const format: tpath.FormatMessage<{ messages: Record<string, string> }> = ({ ctx, keys }) =>
   *   ctx.messages[keys.join('.')];
   * ```
   */
  export type FormatMessage<TContext extends object = {}> = (
    context: FormatContext<TContext>,
  ) => string | undefined;

  /**
   * Map of opt-in extension methods exposed on every path node.
   *
   * Extension names must start with `$` so they do not collide with ordinary
   * translation keys.
   *
   * ```ts
   * const extensions = {
   *   $exists({ ctx, keys }: tpath.ExtensionContext<{ messages: Record<string, string> }>) {
   *     return ctx.messages[keys.join('.')] !== undefined;
   *   },
   * } satisfies tpath.ExtensionMap<{ messages: Record<string, string> }>;
   * ```
   */
  export type ExtensionMap<TContext extends object = {}> = Readonly<
    Record<`$${string}`, (context: ExtensionContext<TContext>, ...args: any[]) => unknown>
  >;

  /**
   * Typed translator proxy for a namespace and its registered extensions.
   *
   * Leaf calls return exactly what the formatter returns: a string or
   * `undefined`.
   */
  export type TPath<TNamespace, TExtensions extends ExtensionMap<any>> = _TPath<
    TNamespace,
    TExtensions
  >;

  /**
   * Chainable builder used to bind context types, extensions, and the formatter.
   */
  export interface Builder<
    TNamespace,
    TContext extends object = {},
    TExtensions extends ExtensionMap<any> = {},
  > {
    /**
     * Adds required context fields to the translator factory.
     *
     * ```ts
     * const createT = tpath<Translations>().ctx<{ locale: string }>().format(format);
     * createT({ locale: 'en' });
     * ```
     */
    ctx<TNextContext extends object>(): Builder<TNamespace, TContext & TNextContext, TExtensions>;
    /**
     * Adds opt-in extension methods to every path node.
     */
    extend<TNextExtensions extends ExtensionMap<TContext>>(
      extensions: TNextExtensions,
    ): Builder<TNamespace, TContext, TExtensions & TNextExtensions>;
    /**
     * Finishes the builder by registering the caller-owned formatter.
     */
    format(formatMessage: FormatMessage<TContext>): Factory<TNamespace, TContext, TExtensions>;
  }

  /**
   * Translator factory produced by {@link Builder.format}.
   *
   * If no context type was declared, the factory is called with no arguments.
   * Otherwise it requires the declared context.
   */
  export type Factory<
    TNamespace,
    TContext extends object,
    TExtensions extends ExtensionMap<any>,
  > = [keyof TContext] extends [never]
    ? (ctx?: never) => TPath<TNamespace, TExtensions>
    : (ctx: Context<TContext>) => TPath<TNamespace, TExtensions>;

  /**
   * Type helper for selecting one or more namespaces from a translation tree.
   *
   * ```ts
   * type CommonOnly = tpath.PickNs<Translations, ['common']>;
   * ```
   */
  export type PickNs<TNamespaces, Ns> = Ns extends
    | [infer F extends keyof TNamespaces, ...infer R]
    | readonly [infer F extends keyof TNamespaces, ...infer R]
    ? Prettify<{ readonly [K in F]: TNamespaces[F] } & PickNs<TNamespaces, R>>
    : unknown;
}

/**
 * Default export alias for {@link tpath}.
 */
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
> = ExtensionMethods<TExtensions> &
  ((...params: TFunctionParams<TNamespace, K>) => string | undefined);

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
    format(formatMessage) {
      return ((ctx = {} as tpath.Context<TContext>) =>
        createTPathProxy<TNamespace, TContext, TExtensions>(
          formatMessage,
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
  formatMessage: tpath.FormatMessage<TContext>,
  extensions: TExtensions,
  previousPath: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.TPath<TNamespace, TExtensions> {
  function format(keys: readonly string[], interpolation?: object) {
    return formatMessage({
      ctx,
      interpolation,
      keys,
    });
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
              format,
              keys: previousPath,
            },
            ...args,
          );
      }

      return createTPathProxy(formatMessage, extensions, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return format(previousPath, argArray[0] as object | undefined);
    },
  }) as unknown as tpath.TPath<TNamespace, TExtensions>;
}
