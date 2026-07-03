/**
 * Creates a typed proxy path definer.
 *
 * TPath collects property names into a string path, then delegates runtime
 * behavior to the resolve function registered with
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
 * const createT = tpath<Translations, TranslationContext>().define((ctx, keys, values) => {
 *     const message = ctx.messages[keys.join('.')];
 *
 *     return values === undefined ? message : message?.replace('{name}', values.name);
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
   * Resolves the definition for explicit keys.
   */
  export type ResolveHelper = <TReturn = unknown>(
    keys: readonly string[],
    ...args: any[]
  ) => TReturn;

  /**
   * Resolve function passed to {@link Definer.define}.
   */
  export type DefinitionResolve<TContext extends object, TDefinition extends object> = (
    ctx: DefinitionContext<TContext, TDefinition>,
    keys: readonly string[],
    ...args: any[]
  ) => unknown;

  /**
   * Extension object shape accepted by {@link Definer.define}.
   */
  export type DefinitionInput<TContext extends object, TDefinition extends object> = Readonly<{
    readonly [K in keyof TDefinition]: TDefinition[K] extends (
      ctx: unknown,
      ...args: infer TArgs
    ) => infer R
      ? (ctx: DefinitionContext<TContext, TDefinition>, ...args: TArgs) => R
      : never;
  }>;

  /**
   * Result of {@link Definer.define}.
   */
  export type DefineResult<
    TNamespace,
    TContext extends object,
    TDefinition extends object,
  > = Factory<TNamespace, TContext, TDefinition>;

  /**
   * Bound extension helpers exposed on path nodes and inside definition methods.
   */
  export type DefinitionHelpers<TDefinition> =
    IsAny<TDefinition> extends true
      ? { readonly [key: `$${string}`]: (...args: any[]) => any } & {
          readonly [key: symbol]: (...args: any[]) => any;
        }
      : {
          readonly [K in keyof TDefinition]: DefinitionMethod<TDefinition[K]>;
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
     * Resolves explicit keys through the same caller-owned resolve function.
     */
    readonly resolve: ResolveHelper;
  } & DefinitionHelpers<TDefinition> & {
      readonly [key: `$${string}`]: (...args: any[]) => any;
      readonly [key: symbol]: (...args: any[]) => any;
    };

  /**
   * Removes the internal context parameter from an extension method.
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
   * runtime value still comes from the caller-owned resolve function.
   */
  export type TPath<TPathTree, TDefinition extends object = {}> = _TPath<TPathTree, TDefinition>;

  /**
   * Definer used to bind the terminal runtime definition.
   */
  export interface Definer<TPathTree, TContext extends object = {}> {
    /**
     * Finishes the definer by registering the caller-owned definition.
     */
    define<TDefinition extends Record<string, DefinitionFunction>>(
      resolve: DefinitionResolve<TContext, any>,
      definition: TDefinition,
    ): Factory<TPathTree, TContext, TDefinition>;
    define(
      resolve: DefinitionResolve<TContext, {}>,
      definition?: undefined,
    ): Factory<TPathTree, TContext, {}>;
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

type DefinitionFunction = (ctx: any, ...args: any[]) => any;

type RuntimeDefinition<TContext extends object, TDefinition extends object> = Readonly<{
  readonly resolve: tpath.DefinitionResolve<TContext, TDefinition>;
  readonly extensions: TDefinition;
}>;

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
    define<TDefinition extends Record<string, DefinitionFunction>>(
      resolve: tpath.DefinitionResolve<TContext, any>,
      definition?: TDefinition,
    ) {
      const runtimeDefinition: RuntimeDefinition<TContext, TDefinition> = {
        resolve: resolve as tpath.DefinitionResolve<TContext, TDefinition>,
        extensions: (definition ?? {}) as TDefinition,
      };

      return ((ctx = {} as tpath.Context<TContext>) =>
        createTPathProxy<TPathTree, TContext, TDefinition>(
          runtimeDefinition,
          [],
          ctx,
        )) as tpath.DefineResult<TPathTree, TContext, TDefinition>;
    },
  };
}

function createTPathProxy<TPathTree, TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  previousPath: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.TPath<TPathTree, TDefinition> {
  return new Proxy(() => undefined, {
    get(_target, key) {
      if (typeof key === 'symbol') {
        const extension = getExtension(definition, key);

        if (extension !== undefined) {
          return (...args: unknown[]) =>
            extension(createDefinitionContext(definition, previousPath, ctx), ...args);
        }

        throw new TypeError('Using Symbol as a path key is not supported.');
      }

      const extension = getExtension(definition, key);

      if (extension !== undefined) {
        return (...args: unknown[]) =>
          extension(createDefinitionContext(definition, previousPath, ctx), ...args);
      }

      return createTPathProxy(definition, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return resolveDefinition(definition, previousPath, ctx, argArray);
    },
  }) as unknown as tpath.TPath<TPathTree, TDefinition>;
}

function resolveDefinition<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  keys: readonly string[],
  ctx: tpath.Context<TContext>,
  args: readonly unknown[],
) {
  const definitionContext = createDefinitionContext(definition, keys, ctx);

  return definition.resolve(definitionContext, definitionContext.keys, ...args);
}

function createDefinitionContext<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  keys: readonly string[],
  ctx: tpath.Context<TContext>,
): tpath.DefinitionContext<TContext, TDefinition> {
  const currentKeys = Object.freeze([...keys]);
  const self: Record<PropertyKey, unknown> = {
    ...ctx,
    keys: currentKeys,
    resolve<TReturn = unknown>(nextKeys: readonly string[], ...nextArgs: any[]) {
      return resolveDefinition(definition, nextKeys, ctx, nextArgs) as TReturn;
    },
  };

  for (const key of Reflect.ownKeys(definition.extensions)) {
    const extension = getExtension(definition, key);

    if (extension !== undefined) {
      self[key] = (...args: unknown[]) =>
        extension(createDefinitionContext(definition, currentKeys, ctx), ...args);
    }
  }

  return self as tpath.DefinitionContext<TContext, TDefinition>;
}

function getExtension<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  key: PropertyKey,
) {
  const value = (definition.extensions as Readonly<Record<PropertyKey, unknown>>)[key];

  return typeof value === 'function' ? value : undefined;
}
