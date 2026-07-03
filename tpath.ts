/**
 * Creates a typed proxy path definer.
 *
 * TPath collects property names into a string path, then delegates runtime
 * behavior to the `__call` method registered with
 * {@link tpath.Definer.define}. Use nested objects for path segments and
 * function leaves for typed call sites.
 *
 * ```ts
 * type Translations = {
 *   readonly common: {
 *     readonly title: () => string | undefined;
 *     readonly greeting: (values: { readonly name: string }) => string | undefined;
 *   };
 * };
 *
 * type TranslationContext = {
 *   readonly messages: Readonly<Record<string, string | undefined>>;
 * };
 *
 * const createT = tpath<Translations, TranslationContext>().define({
 *   __call(ctx, keys, values) {
 *     const message = ctx.messages[keys.join('.')];
 *
 *     return values === undefined ? message : message?.replace('{name}', values.name);
 *   },
 * });
 *
 * const t = createT({
 *   messages: {
 *     'common.title': 'Home',
 *     'common.greeting': 'Hello, {name}!',
 *   },
 * });
 *
 * t.common.title(); // "Home"
 * t.common.greeting({ name: 'Ada' }); // "Hello, Ada!"
 * ```
 */
export function tpath<TPathTree, TContext extends object = {}>(): tpath.Definer<
  TPathTree,
  TContext
> {
  return createTPathDefiner<TPathTree, TContext>();
}

/**
 * Public types that describe TPath definers, factories, typed path proxies, and
 * definition callbacks.
 */
export namespace tpath {
  /**
   * Immutable user context bound when a path factory is called.
   *
   * ```ts
   * type TContext = tpath.Context<{ locale: string }>;
   * ```
   */
  export type Context<TUserContext extends object = {}> = Readonly<TUserContext>;

  /**
   * Function leaf shorthand for typed path trees.
   *
   * ```ts
   * type Api = {
   *   readonly users: {
   *     readonly byId: tpath.Leaf<[id: string], Promise<User>>;
   *   };
   * };
   * ```
   */
  export type Leaf<TArgs extends readonly unknown[] = [], TReturn = unknown> = (
    ...args: TArgs
  ) => TReturn;

  /**
   * Bound helper exposed inside definition methods.
   *
   * Calls the `__call` definition for explicit keys.
   */
  export type CallHelper = <TReturn = unknown>(keys: readonly string[], ...args: any[]) => TReturn;

  /**
   * Definition object passed to {@link Definer.define}.
   *
   * `__call` is required and handles leaf calls. `$...` methods are exposed on
   * every path node.
   */
  export type Definition = Readonly<{
    readonly __call: (
      ctx: DefinitionContext<any, any>,
      keys: readonly string[],
      ...args: any[]
    ) => unknown;
  }>;

  /**
   * Definition object shape accepted by {@link Definer.define}.
   */
  export type DefinitionInput<TContext extends object> = Readonly<{
    readonly __call: (
      ctx: DefinitionContext<TContext, any>,
      keys: readonly string[],
      ...args: any[]
    ) => unknown;
  }> &
    Readonly<{
      readonly [key: `$${string}`]: (ctx: DefinitionContext<TContext, any>, ...args: any[]) => any;
    }>;

  /**
   * Result of {@link Definer.define}. Missing or invalid `__call` definitions
   * produce `never`, so the definer cannot be used as a path factory.
   */
  export type DefineResult<TNamespace, TContext extends object, TDefinition extends object> =
    TDefinition extends DefinitionInput<TContext>
      ? Factory<TNamespace, TContext, TDefinition>
      : never;

  /**
   * Bound `$...` helpers exposed on path nodes and inside definition methods.
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
   * Typed proxy for a path tree and its registered `$...` helpers.
   *
   * Function leaves keep their declared public argument and return types. The
   * runtime value still comes from the caller-owned `__call` definition.
   */
  export type TPath<TPathTree, TDefinition extends object = {}> = _TPath<TPathTree, TDefinition>;

  /**
   * Definer used to bind the terminal runtime definition.
   */
  export interface Definer<TPathTree, TContext extends object = {}> {
    /**
     * Finishes the definer by registering the caller-owned definition.
     */
    define<TDefinition extends DefinitionInput<TContext>>(
      definition: TDefinition,
    ): Factory<TPathTree, TContext, TDefinition>;
  }

  /**
   * Path factory produced by {@link Definer.define}.
   *
   * If no context type was declared, the factory is called with no arguments.
   * Otherwise it requires the declared context.
   */
  export type Factory<TPathTree, TContext extends object, TDefinition extends object> = [
    keyof TContext,
  ] extends [never]
    ? (ctx?: never) => TPath<TPathTree, TDefinition>
    : (ctx: Context<TContext>) => TPath<TPathTree, TDefinition>;
}

/**
 * Default export alias for {@link tpath}.
 */
export default tpath;

type IsAny<T> = 0 extends 1 & T ? true : false;

type TLeafFunction<TLeaf, TDefinition extends object> = tpath.DefinitionHelpers<
  ExtractDefinition<TDefinition>
> &
  (TLeaf extends (...args: infer TArgs) => infer TReturn ? (...args: TArgs) => TReturn : never);

type _TPath<TPathTree, TDefinition extends object> = tpath.DefinitionHelpers<
  ExtractDefinition<TDefinition>
> &
  (TPathTree extends (...args: any[]) => unknown
    ? TLeafFunction<TPathTree, TDefinition>
    : TPathTree extends object
      ? { readonly [K in keyof TPathTree]: _TPath<TPathTree[K], TDefinition> }
      : never);

type ExtractDefinition<TDefinition extends object> = TDefinition;

function createTPathDefiner<TPathTree, TContext extends object>(): tpath.Definer<
  TPathTree,
  TContext
> {
  return {
    define<TDefinition extends tpath.DefinitionInput<TContext>>(definition: TDefinition) {
      return ((ctx = {} as tpath.Context<TContext>) =>
        createTPathProxy<TPathTree, TContext, TDefinition>(
          definition as unknown as TDefinition & tpath.Definition,
          [],
          ctx,
        )) as tpath.DefineResult<TPathTree, TContext, TDefinition>;
    },
  };
}

function createTPathProxy<TPathTree, TContext extends object, TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  previousPath: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.TPath<TPathTree, TDefinition> {
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
      return callDefinition(definition, previousPath, ctx, argArray);
    },
  }) as unknown as tpath.TPath<TPathTree, TDefinition>;
}

function callDefinition<TContext extends object, TDefinition extends object>(
  definition: TDefinition & tpath.Definition,
  keys: readonly string[],
  ctx: tpath.Context<TContext>,
  args: readonly unknown[],
) {
  const definitionContext = createDefinitionContext(definition, keys, ctx);

  return definition.__call(definitionContext, definitionContext.keys, ...args);
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
    __call<TReturn = unknown>(nextKeys: readonly string[], ...nextArgs: any[]) {
      return callDefinition(definition, nextKeys, ctx, nextArgs) as TReturn;
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
