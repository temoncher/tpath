/**
 * Creates a typed translation path builder for a translation tree.
 *
 * The builder collects property names into a path and delegates every runtime
 * lookup, fallback, interpolation, and error policy to the `__call` method
 * registered with {@link tpath.Builder.define}.
 *
 * ```ts
 * const messages = { 'common.home.title': 'Home' };
 * const createT = tpath<{ common: { home: { title: 'Home' } } }>()
 *     .ctx<{ messages: typeof messages }>()
 *     .define({
 *       __call(ctx, keys) {
 *         return ctx.messages[keys.join('.')];
 *       },
 *     });
 * const t = createT({ messages });
 *
 * t.common.home.title(); // "Home"
 * ```
 */
export function tpath<TNamespace>(): tpath.Builder<TNamespace> {
  return createTPathBuilder<TNamespace, {}>();
}

/**
 * Public types that describe TPath builders, factories, translators, and
 * definition callbacks.
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
   * Bound helper exposed inside definition methods.
   *
   * Calls the `__call` definition for explicit keys.
   */
  export type CallHelper = (keys: readonly string[], interpolation?: object) => string | undefined;

  /**
   * Definition object passed to {@link Builder.define}.
   *
   * `__call` is required and handles leaf calls. `$...` methods are exposed on
   * every translated path node.
   */
  export type Definition = Readonly<{
    readonly __call: (
      ctx: DefinitionContext<any, any>,
      keys: readonly string[],
      interpolation?: object,
    ) => string | undefined;
  }>;

  /**
   * Definition object shape accepted by {@link Builder.define}.
   */
  export type DefinitionInput<TContext extends object> = Readonly<{
    readonly __call: (
      ctx: DefinitionContext<TContext, any>,
      keys: readonly string[],
      interpolation?: object,
    ) => string | undefined;
  }> &
    Readonly<{
      readonly [key: `$${string}`]: (ctx: DefinitionContext<TContext, any>, ...args: any[]) => any;
    }>;

  /**
   * Result of {@link Builder.define}. Missing or invalid `__call` definitions
   * produce `never`, so the builder cannot be used as a translator factory.
   */
  export type DefineResult<TNamespace, TContext extends object, TDefinition extends object> =
    TDefinition extends DefinitionInput<TContext>
      ? Factory<TNamespace, TContext, TDefinition>
      : never;

  /**
   * Bound `$...` helpers exposed on translated path nodes and inside definition
   * methods.
   */
  export type DefinitionHelpers<TDefinition> =
    IsAny<TDefinition> extends true
      ? { readonly [key: `$${string}`]: (...args: any[]) => any }
      : {
          readonly [K in keyof TDefinition as K extends `$${string}` ? K : never]: DefinitionMethod<
            TDefinition[K]
          >;
        };

  /**
   * Runtime context value passed as the first argument to every definition
   * method.
   */
  export type DefinitionContext<
    TContext extends object,
    TDefinition extends object,
  > = Context<TContext> & {
    /**
     * The collected path at the current call site.
     */
    readonly keys: readonly string[];
    /**
     * Calls the `__call` definition for explicit keys.
     */
    readonly __call: CallHelper;
  } & DefinitionHelpers<TDefinition> & {
      readonly [key: `$${string}`]: (...args: any[]) => any;
    };

  /**
   * Removes the internal context parameter from a definition method.
   */
  export type DefinitionMethod<T> = T extends (...args: infer TArgs) => infer R
    ? TArgs extends [ctx: unknown, ...args: infer TPublicArgs]
      ? (...args: TPublicArgs) => R
      : never
    : never;

  /**
   * Typed translator proxy for a namespace and its registered `$...` helpers.
   *
   * Leaf calls return exactly what `__call` returns: a string or `undefined`.
   */
  export type TPath<TNamespace, TDefinition extends object = {}> = _TPath<TNamespace, TDefinition>;

  /**
   * Chainable builder used to bind context types and the terminal definition.
   */
  export interface Builder<TNamespace, TContext extends object = {}> {
    /**
     * Adds required context fields to the translator factory.
     *
     * ```ts
     * const createT = tpath<Translations>()
     *   .ctx<{ locale: string }>()
     *   .define({ __call(ctx) { return ctx.locale; } });
     * createT({ locale: 'en' });
     * ```
     */
    ctx<TNextContext extends object>(): Builder<TNamespace, TContext & TNextContext>;
    /**
     * Finishes the builder by registering the caller-owned definition.
     */
    define<TDefinition extends DefinitionInput<TContext>>(
      definition: TDefinition,
    ): Factory<TNamespace, TContext, TDefinition>;
  }

  /**
   * Translator factory produced by {@link Builder.define}.
   *
   * If no context type was declared, the factory is called with no arguments.
   * Otherwise it requires the declared context.
   */
  export type Factory<TNamespace, TContext extends object, TDefinition extends object> = [
    keyof TContext,
  ] extends [never]
    ? (ctx?: never) => TPath<TNamespace, TDefinition>
    : (ctx: Context<TContext>) => TPath<TNamespace, TDefinition>;

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
type IsAny<T> = 0 extends 1 & T ? true : false;
type InterpolationValues<S extends string> = Readonly<
  Record<GetInterpolationKeys<S>, string | number>
>;
type TFunctionParams<TNamespace, TKey extends keyof TNamespace> = TNamespace[TKey] extends string
  ? TNamespace[TKey] extends `${string}{${string}}${string}`
    ? [interpolation: InterpolationValues<TNamespace[TKey]>]
    : []
  : never;

type TLeafFunction<
  TNamespace,
  K extends keyof TNamespace,
  TDefinition extends object,
> = tpath.DefinitionHelpers<ExtractDefinition<TDefinition>> &
  ((...params: TFunctionParams<TNamespace, K>) => string | undefined);

type _TPath<TNamespace, TDefinition extends object> = tpath.DefinitionHelpers<
  ExtractDefinition<TDefinition>
> & {
  readonly [K in keyof TNamespace]: TNamespace[K] extends string
    ? TLeafFunction<TNamespace, K, TDefinition>
    : _TPath<TNamespace[K], TDefinition>;
};

type ExtractDefinition<TDefinition extends object> = TDefinition;

function createTPathBuilder<TNamespace, TContext extends object>(): tpath.Builder<
  TNamespace,
  TContext
> {
  return {
    ctx<TNextContext extends object>() {
      return createTPathBuilder<TNamespace, TContext & TNextContext>();
    },
    define<TDefinition extends tpath.DefinitionInput<TContext>>(definition: TDefinition) {
      return ((ctx = {} as tpath.Context<TContext>) =>
        createTPathProxy<TNamespace, TContext, TDefinition>(
          definition as unknown as TDefinition & tpath.Definition,
          [],
          ctx,
        )) as tpath.DefineResult<TNamespace, TContext, TDefinition>;
    },
  };
}

function createTPathProxy<TNamespace, TContext extends object, TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  previousPath: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.TPath<TNamespace, TDefinition> {
  return new Proxy(() => undefined, {
    get(_target, key) {
      if (typeof key === 'symbol') {
        throw new TypeError(
          'Using Symbol as a key is not supported, as the proxy only works with strings.',
        );
      }

      if (key === '__call') {
        throw new TypeError('__call is reserved for tpath definitions.');
      }

      const extension = getExtension(definition, key);

      if (extension !== undefined) {
        return (...args: unknown[]) =>
          extension(createDefinitionContext(definition, previousPath, ctx), ...args);
      }

      return createTPathProxy(definition, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return callDefinition(definition, previousPath, ctx, argArray[0] as object | undefined);
    },
  }) as unknown as tpath.TPath<TNamespace, TDefinition>;
}

function callDefinition<TContext extends object, TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  keys: readonly string[],
  ctx: tpath.Context<TContext>,
  interpolation: object | undefined,
) {
  const definitionContext = createDefinitionContext(definition, keys, ctx);

  return definition.__call(definitionContext, definitionContext.keys, interpolation);
}

function createDefinitionContext<TContext extends object, TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  keys: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.DefinitionContext<TContext, TDefinition> {
  const currentKeys = Object.freeze([...keys]);
  const self: Record<PropertyKey, unknown> = {
    ...ctx,
    keys: currentKeys,
    __call(nextKeys: readonly string[], nextInterpolation?: object) {
      return callDefinition(definition, nextKeys, ctx, nextInterpolation);
    },
  };

  for (const key of Object.keys(definition)) {
    if (!key.startsWith('$')) {
      continue;
    }

    const extension = getExtension(definition, key);

    if (extension !== undefined) {
      self[key] = (...args: unknown[]) =>
        extension(createDefinitionContext(definition, currentKeys, ctx), ...args);
    }
  }

  return self as tpath.DefinitionContext<TContext, TDefinition>;
}

function getExtension<TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  key: string,
) {
  if (!key.startsWith('$')) {
    return undefined;
  }

  return (definition as Readonly<Record<string, ((...args: unknown[]) => unknown) | undefined>>)[
    key
  ];
}
