/**
 * Creates a typed proxy path definer.
 *
 * tpath collects property names into a string path, then delegates runtime
 * behavior to the terminal resolver registered with `define`. Use nested
 * objects for path segments and function leaves for typed call sites.
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
 *   const message = ctx.messages[keys.join('.')];
 *
 *   return values === undefined ? message : message?.replace('{name}', values.name);
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
export function tpath<TTree, TContext extends object = {}>(): Definer<TTree, TContext> {
  return createPathDefiner<TTree, TContext>();
}

/**
 * Public advanced types for extracted definition callbacks.
 */
export namespace tpath {
  /**
   * Resolve function passed to `define`.
   */
  export type DefinitionResolve<
    TContext extends object,
    TExtensions extends object,
  > = DefinitionResolveFn<TContext, TExtensions>;

  /**
   * Runtime context value passed as the first argument to every definition
   * method.
   */
  export type DefinitionContext<
    TContext extends object,
    TExtensions extends object,
  > = DefinitionContextValue<TContext, TExtensions>;
}

/**
 * Immutable user context bound when a path factory is called.
 */
type Context<TUserContext extends object = {}> = Readonly<TUserContext>;

/**
 * Bound resolver exposed inside definition methods.
 *
 * Resolves the definition for explicit keys.
 */
type ResolveHelper = <TReturn = unknown>(keys: readonly string[], ...args: unknown[]) => TReturn;

/**
 * Resolve function passed to {@link Definer.define}.
 */
type DefinitionResolveFn<TContext extends object, TExtensions extends object> = (
  ctx: DefinitionContextValue<TContext, TExtensions>,
  keys: readonly string[],
  ...args: unknown[]
) => unknown;

/**
 * Extension function declared with {@link Definer.extend}.
 */
type DefinitionExtensionFn<TContext extends object, TExtensions extends object> = (
  ctx: DefinitionContextValue<TContext, TExtensions>,
  ...args: any[]
) => unknown;

/**
 * Object accepted by {@link Definer.extend}.
 */
type DefinitionExtensionInput<TContext extends object, TExtensions extends object> = Record<
  PropertyKey,
  DefinitionExtensionFn<TContext, TExtensions>
>;

/**
 * Bound extensions exposed on path nodes and inside later definition methods.
 */
type DefinitionHelpers<TExtensions extends object> =
  IsAny<TExtensions> extends true
    ? { readonly [key: string]: (...args: any[]) => any } & {
        readonly [key: symbol]: (...args: any[]) => any;
      }
    : Pick<TExtensions, KnownKeys<TExtensions>>;

/**
 * Runtime context value passed as the first argument to every definition
 * method.
 */
type DefinitionContextValue<
  TContext extends object,
  TExtensions extends object,
> = Context<TContext> & {
  /**
   * The collected path at the current call site.
   */
  readonly keys: readonly string[];
  /**
   * Resolves explicit keys through the same caller-owned resolve function.
   */
  readonly resolve: ResolveHelper;
} & DefinitionHelpers<TExtensions>;

/**
 * User-declared extension methods excluding broad index signatures.
 */
type DefinitionExtensions<TDefinition extends object> = {
  readonly [K in KnownKeys<TDefinition>]: DefinitionMethod<TDefinition[K]>;
};

type KnownKeys<T> = {
  [K in keyof T]: string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K;
}[keyof T];

/**
 * Removes the internal context parameter from an extension method.
 */
type DefinitionMethod<T> = T extends (ctx: any, ...args: infer TPublicArgs) => infer R
  ? (...args: TPublicArgs) => R
  : never;

type MergeExtensions<TPrevious extends object, TNext extends object> = Omit<
  TPrevious,
  keyof TNext
> &
  TNext;

/**
 * Typed proxy for a path tree and its registered extensions.
 *
 * Function leaves keep their declared public argument and return types. The
 * runtime value still comes from the caller-owned resolve function.
 */
type Path<TTree, TExtensions extends object = {}> = PathProxy<TTree, TExtensions>;

/**
 * Definer used to register extensions before binding the terminal runtime
 * resolver.
 */
interface Definer<TTree, TContext extends object = {}, TExtensions extends object = {}> {
  /**
   * Adds extension methods to every path node.
   *
   * Each extension receives a generated context as its first argument. That
   * context includes the factory context, current path keys, the explicit-key
   * resolve helper, and extensions declared by previous `extend` calls.
   */
  extend<TDefinition extends DefinitionExtensionInput<TContext, TExtensions>>(
    definition: TDefinition,
  ): Definer<TTree, TContext, MergeExtensions<TExtensions, DefinitionExtensions<TDefinition>>>;

  /**
   * Finishes the definer by registering the caller-owned resolver.
   */
  define(
    resolve: DefinitionResolveFn<TContext, TExtensions>,
  ): Factory<TTree, TContext, TExtensions>;
}

/**
 * Path factory produced by {@link Definer.define}.
 *
 * If no context type was declared, the factory is called with no arguments.
 * Otherwise it requires the declared context.
 */
type Factory<TTree, TContext extends object, TExtensions extends object> = [
  keyof TContext,
] extends [never]
  ? (ctx?: never) => Path<TTree, TExtensions>
  : (ctx: Context<TContext>) => Path<TTree, TExtensions>;

/**
 * Default export alias for {@link tpath}.
 */
export default tpath;

type IsAny<T> = 0 extends 1 & T ? true : false;

type RuntimeDefinition<TContext extends object, TExtensions extends object> = Readonly<{
  readonly resolve: DefinitionResolveFn<TContext, TExtensions>;
  readonly extensions: ReadonlyMap<PropertyKey, RuntimeExtension>;
}>;

type RuntimeExtension = Readonly<{
  readonly fn: RuntimeExtensionFn;
  readonly key: PropertyKey;
}>;

type RuntimeExtensionFn = (ctx: any, ...args: any[]) => unknown;

type TLeafFunction<TLeaf, TExtensions extends object> = DefinitionHelpers<
  ExtractDefinition<TExtensions>
> &
  (TLeaf extends (...args: infer TArgs) => infer TReturn ? (...args: TArgs) => TReturn : never);

type PathProxy<TTree, TExtensions extends object> = DefinitionHelpers<
  ExtractDefinition<TExtensions>
> &
  (TTree extends (...args: any[]) => unknown
    ? TLeafFunction<TTree, TExtensions>
    : TTree extends object
      ? { readonly [K in keyof TTree]: PathProxy<TTree[K], TExtensions> }
      : never);

type ExtractDefinition<TExtensions extends object> = TExtensions;

function createPathDefiner<TTree, TContext extends object, TExtensions extends object = {}>(
  extensions: ReadonlyMap<PropertyKey, RuntimeExtension> = new Map(),
): Definer<TTree, TContext, TExtensions> {
  function extend<TDefinition extends DefinitionExtensionInput<TContext, TExtensions>>(
    definition: TDefinition,
  ): Definer<TTree, TContext, MergeExtensions<TExtensions, DefinitionExtensions<TDefinition>>> {
    return createPathDefiner<
      TTree,
      TContext,
      MergeExtensions<TExtensions, DefinitionExtensions<TDefinition>>
    >(extendRuntimeDefinitions(extensions, definition));
  }

  function define(
    resolve: DefinitionResolveFn<TContext, TExtensions>,
  ): Factory<TTree, TContext, TExtensions> {
    if (typeof resolve !== 'function') {
      throw new TypeError('tpath define requires a resolve function.');
    }

    const runtimeDefinition: RuntimeDefinition<TContext, TExtensions> = {
      resolve,
      extensions,
    };

    return ((ctx = {} as Context<TContext>) =>
      createPathProxy<TTree, TContext, TExtensions>(runtimeDefinition, [], ctx)) as Factory<
      TTree,
      TContext,
      TExtensions
    >;
  }

  return { define, extend };
}

function extendRuntimeDefinitions(
  extensions: ReadonlyMap<PropertyKey, RuntimeExtension>,
  definition: Readonly<Record<PropertyKey, unknown>>,
): ReadonlyMap<PropertyKey, RuntimeExtension> {
  const nextExtensions = new Map(extensions);

  for (const key of Reflect.ownKeys(definition)) {
    const fn = definition[key];

    if (typeof fn !== 'function') {
      throw new TypeError('tpath extend requires extension functions.');
    }

    nextExtensions.set(key, {
      fn: fn as RuntimeExtensionFn,
      key,
    });
  }

  return nextExtensions;
}

function createPathProxy<TTree, TContext extends object, TExtensions extends object>(
  definition: RuntimeDefinition<TContext, TExtensions>,
  previousPath: readonly string[],
  ctx: Context<TContext>,
): Path<TTree, TExtensions> {
  return new Proxy(() => undefined, {
    get(_target, key) {
      if (typeof key === 'symbol') {
        const extension = getExtension(definition, key);

        if (extension !== undefined) {
          return (...args: unknown[]) =>
            extension.fn(createDefinitionContext(definition, previousPath, ctx), ...args);
        }

        throw new TypeError('Using Symbol as a path key is not supported.');
      }

      const extension = getExtension(definition, key);

      if (extension !== undefined) {
        return (...args: unknown[]) =>
          extension.fn(createDefinitionContext(definition, previousPath, ctx), ...args);
      }

      return createPathProxy(definition, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return resolveDefinition(definition, previousPath, ctx, argArray);
    },
  }) as unknown as Path<TTree, TExtensions>;
}

function resolveDefinition<TContext extends object, TExtensions extends object>(
  definition: RuntimeDefinition<TContext, TExtensions>,
  keys: readonly string[],
  ctx: Context<TContext>,
  args: readonly unknown[],
) {
  const definitionContext = createDefinitionContext(definition, keys, ctx);

  return definition.resolve(definitionContext, definitionContext.keys, ...args);
}

function createDefinitionContext<TContext extends object, TExtensions extends object>(
  definition: RuntimeDefinition<TContext, TExtensions>,
  keys: readonly string[],
  ctx: Context<TContext>,
): DefinitionContextValue<TContext, TExtensions> {
  const currentKeys = Object.freeze([...keys]);
  const self: Record<PropertyKey, unknown> = {
    ...ctx,
    keys: currentKeys,
    resolve<TReturn = unknown>(nextKeys: readonly string[], ...nextArgs: unknown[]) {
      return resolveDefinition(definition, nextKeys, ctx, nextArgs) as TReturn;
    },
  };

  for (const extension of definition.extensions.values()) {
    self[extension.key] = (...args: unknown[]) =>
      extension.fn(createDefinitionContext(definition, currentKeys, ctx), ...args);
  }

  return self as DefinitionContextValue<TContext, TExtensions>;
}

function getExtension<TContext extends object, TExtensions extends object>(
  definition: RuntimeDefinition<TContext, TExtensions>,
  key: PropertyKey,
) {
  return definition.extensions.get(key);
}
