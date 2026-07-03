/**
 * Creates a typed proxy path definer.
 *
 * tpath collects property names into a string path, then delegates runtime
 * behavior to the resolve function registered with
 * `define`. Use nested objects for path segments and
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
    TDefinition extends object,
  > = DefinitionResolveFn<TContext, TDefinition>;

  /**
   * Runtime context value passed as the first argument to every definition
   * method.
   */
  export type DefinitionContext<
    TContext extends object,
    TDefinition extends object,
  > = DefinitionContextValue<TContext, TDefinition>;
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
type ResolveHelper = <TReturn = unknown>(keys: readonly string[], ...args: any[]) => TReturn;

/**
 * Resolve function passed to {@link Definer.define}.
 */
type DefinitionResolveFn<TContext extends object, TDefinition extends object> = (
  ctx: DefinitionContextValue<TContext, TDefinition>,
  keys: readonly string[],
  ...args: any[]
) => unknown;

/**
 * Bound extensions exposed on path nodes and inside definition methods.
 */
type DefinitionHelpers<TDefinition> =
  IsAny<TDefinition> extends true
    ? { readonly [key: string]: (...args: any[]) => any } & {
        readonly [key: symbol]: (...args: any[]) => any;
      }
    : {
        readonly [K in keyof TDefinition]: DefinitionMethod<TDefinition[K]>;
      };

/**
 * Runtime context value passed as the first argument to every definition
 * method.
 */
type DefinitionContextValue<
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
} & DefinitionHelpers<TDefinition>;

/**
 * Removes the internal context parameter from an extension method.
 */
type DefinitionMethod<T> = T extends (ctx: any, ...args: infer TPublicArgs) => infer R
  ? (...args: TPublicArgs) => R
  : never;

/**
 * Typed proxy for a path tree and its registered extensions.
 *
 * Function leaves keep their declared public argument and return types. The
 * runtime value still comes from the caller-owned resolve function.
 */
type Path<TTree, TDefinition extends object = {}> = PathProxy<TTree, TDefinition>;

/**
 * Definer used to bind the terminal runtime definition.
 */
interface Definer<TTree, TContext extends object = {}> {
  /**
   * Finishes the definer by registering the caller-owned definition.
   */
  define<TDefinition extends Record<PropertyKey, DefinitionFunction>>(
    resolve: DefinitionResolveFn<TContext, any>,
    definition: TDefinition,
  ): Factory<TTree, TContext, TDefinition>;
  define(
    resolve: DefinitionResolveFn<TContext, {}>,
    definition?: undefined,
  ): Factory<TTree, TContext, {}>;
}

/**
 * Path factory produced by {@link Definer.define}.
 *
 * If no context type was declared, the factory is called with no arguments.
 * Otherwise it requires the declared context.
 */
type Factory<TTree, TContext extends object, TDefinition extends object> = [
  keyof TContext,
] extends [never]
  ? (ctx?: never) => Path<TTree, TDefinition>
  : (ctx: Context<TContext>) => Path<TTree, TDefinition>;

/**
 * Default export alias for {@link tpath}.
 */
export default tpath;

type IsAny<T> = 0 extends 1 & T ? true : false;

type DefinitionFunction = (ctx: any, ...args: any[]) => any;

type RuntimeDefinition<TContext extends object, TDefinition extends object> = Readonly<{
  readonly resolve: DefinitionResolveFn<TContext, TDefinition>;
  readonly extensions: TDefinition;
}>;

type TLeafFunction<TLeaf, TDefinition extends object> = DefinitionHelpers<
  ExtractDefinition<TDefinition>
> &
  (TLeaf extends (...args: infer TArgs) => infer TReturn ? (...args: TArgs) => TReturn : never);

type PathProxy<TTree, TDefinition extends object> = DefinitionHelpers<
  ExtractDefinition<TDefinition>
> &
  (TTree extends (...args: any[]) => unknown
    ? TLeafFunction<TTree, TDefinition>
    : TTree extends object
      ? { readonly [K in keyof TTree]: PathProxy<TTree[K], TDefinition> }
      : never);

type ExtractDefinition<TDefinition extends object> = TDefinition;

function createPathDefiner<TTree, TContext extends object>(): Definer<TTree, TContext> {
  return {
    define<TDefinition extends Record<PropertyKey, DefinitionFunction>>(
      resolve: DefinitionResolveFn<TContext, any>,
      definition?: TDefinition,
    ) {
      const runtimeDefinition: RuntimeDefinition<TContext, TDefinition> = {
        resolve: resolve as DefinitionResolveFn<TContext, TDefinition>,
        extensions: (definition ?? {}) as TDefinition,
      };

      return ((ctx = {} as Context<TContext>) =>
        createPathProxy<TTree, TContext, TDefinition>(runtimeDefinition, [], ctx)) as Factory<
        TTree,
        TContext,
        TDefinition
      >;
    },
  };
}

function createPathProxy<TTree, TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  previousPath: readonly string[],
  ctx: Context<TContext>,
): Path<TTree, TDefinition> {
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

      return createPathProxy(definition, [...previousPath, key], ctx);
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      return resolveDefinition(definition, previousPath, ctx, argArray);
    },
  }) as unknown as Path<TTree, TDefinition>;
}

function resolveDefinition<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  keys: readonly string[],
  ctx: Context<TContext>,
  args: readonly unknown[],
) {
  const definitionContext = createDefinitionContext(definition, keys, ctx);

  return definition.resolve(definitionContext, definitionContext.keys, ...args);
}

function createDefinitionContext<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  keys: readonly string[],
  ctx: Context<TContext>,
): DefinitionContextValue<TContext, TDefinition> {
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

  return self as DefinitionContextValue<TContext, TDefinition>;
}

function getExtension<TContext extends object, TDefinition extends object>(
  definition: RuntimeDefinition<TContext, TDefinition>,
  key: PropertyKey,
) {
  const value = (definition.extensions as Readonly<Record<PropertyKey, unknown>>)[key];

  return typeof value === 'function' ? value : undefined;
}
