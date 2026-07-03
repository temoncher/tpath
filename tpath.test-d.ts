import { assertType, expectTypeOf, test } from 'vitest';

import { tpath } from './tpath';

interface TranslationCalls {
  readonly common: {
    readonly home: {
      readonly title: () => string | undefined;
      readonly greeting: (interpolation: { readonly name: string }) => string | undefined;
      readonly score: (interpolation: {
        readonly name: string;
        readonly score: number;
      }) => string | undefined;
    };
  };
  readonly admin: {
    readonly users: {
      readonly count: (interpolation: { readonly count: number }) => string | undefined;
    };
  };
}

interface TranslationCallsWithDollarKeys {
  readonly common: {
    readonly home: {
      readonly $exists: () => string | undefined;
      readonly title: () => string | undefined;
    };
  };
}

interface TranslationCallsWithDefinitionKey {
  readonly common: {
    readonly home: {
      readonly __call: () => string | undefined;
      readonly title: () => string | undefined;
    };
  };
}

interface User {
  readonly id: string;
}

interface Config {
  readonly baseUrl: string;
}

interface ApiPaths {
  readonly users: {
    readonly byId: (id: string) => Promise<User>;
    readonly search: (query: string, limit?: number) => readonly User[];
  };
  readonly config: {
    readonly current: () => Config;
  };
}

function appendKey(keys: readonly string[], key: string | undefined): readonly string[] {
  if (key === undefined) {
    return keys;
  }

  return [...keys, key];
}

function formatWithDebug(
  keys: readonly string[],
  ctx: {
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  },
): string | undefined {
  if (ctx.debug) {
    return keys.join('.');
  }

  return ctx.messages[keys.join('.')] ?? 'value';
}

test('types function leaves as user-defined path calls', () => {
  const createP = tpath<ApiPaths>().define(() => undefined);
  const p = createP();

  assertType<Promise<User>>(p.users.byId('42'));
  assertType<readonly User[]>(p.users.search('ada', 10));
  assertType<readonly User[]>(p.users.search('ada'));
  assertType<Config>(p.config.current());

  // @ts-expect-error missing leaf argument
  p.users.byId();

  // @ts-expect-error wrong leaf argument type
  p.users.search(1);
});

test('does not export a function leaf alias', () => {
  // @ts-expect-error function leaves should be ordinary function types
  expectTypeOf<tpath.Leaf<[], string>>();
});

test('exports resolve function type for define callbacks', () => {
  type Resolve = tpath.DefinitionResolve<
    { readonly messages: Readonly<Record<string, string | undefined>> },
    {}
  >;
  const resolve: Resolve = (ctx, keys) => {
    expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
    assertType<readonly string[]>(keys);

    return ctx.messages[keys.join('.')];
  };
  const createT = tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define(resolve);
  const t = createT({
    messages: {
      'common.home.title': 'Home',
    },
  });

  assertType<string | undefined>(t.common.home.title());
});

test('types resolve-first definitions with second-argument extensions', () => {
  const createT = tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define(
    (ctx, keys, interpolation) => {
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
      assertType<unknown>(ctx.$key());
      assertType<string | undefined>(
        ctx.resolve<string | undefined>(['common', 'home', 'title'], interpolation),
      );
      assertType<readonly string[]>(keys);
      assertType<unknown>(interpolation);

      return ctx.messages[keys.join('.')];
    },
    {
      $key(ctx, key?: string) {
        assertType<readonly string[]>(ctx.keys);
        assertType<Readonly<Record<string, string | undefined>>>(ctx.messages);
        assertType<string | undefined>(key);

        return appendKey(ctx.keys, key).join('.');
      },
      $(ctx, key: string, interpolation?: object) {
        return ctx.resolve(appendKey(ctx.keys, key), interpolation) as string | undefined;
      },
    },
  );
  const t = createT({
    messages: {},
  });

  assertType<string | undefined>(t.common.home.title());
  assertType<string>(t.common.home.title.$key());
  assertType<string | undefined>(t.common.$('home.title'));

  // @ts-expect-error public extension calls do not accept the internal ctx argument
  t.common.home.$key({ keys: [] });
});

test('types nested translation paths', () => {
  const createT = tpath<TranslationCalls>().define(() => 'value');
  const t = createT();

  assertType<string | undefined>(t.common.home.title());
  assertType<string | undefined>(t.common.home.greeting({ name: 'Ada' }));
  assertType<string | undefined>(t.common.home.score({ name: 'Ada', score: 7 }));
  assertType<string | undefined>(t.admin.users.count({ count: 2 }));

  // @ts-expect-error missing namespace
  assertType<unknown>(t.missing);

  // @ts-expect-error missing nested key
  assertType<unknown>(t.common.missing);
});

test('requires interpolation only for messages that declare it', () => {
  const createT = tpath<TranslationCalls>().define(() => 'value');
  const t = createT();

  t.common.home.title();

  // @ts-expect-error plain messages do not accept interpolation
  t.common.home.title({});

  // @ts-expect-error interpolation is required
  t.common.home.greeting();

  // @ts-expect-error interpolation key is required
  t.common.home.greeting({});

  // @ts-expect-error interpolation value must be a string or number
  t.common.home.greeting({ name: true });
});

test('does not accept context when no context type is declared', () => {
  const createT = tpath<TranslationCalls>().define(() => 'value');
  const t = createT();

  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error no context argument is accepted without .ctx()
  createT({});
});

test('accepts context as the second tpath generic', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define((ctx, keys, interpolation) => {
    expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
    expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
    assertType<unknown>(interpolation);

    return ctx.messages[keys.join('.')];
  });

  const t = createT({
    messages: {
      'common.home.title': 'Home',
    },
  });

  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error factory requires context declared by the second generic
  createT();

  // @ts-expect-error missing context property
  createT({});
});

test('types ctx-first definition functions', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define(
    (ctx, keys, interpolation) => {
      assertType<string | undefined>(
        ctx.resolve<string | undefined>(['common', 'home', 'title'], interpolation),
      );
      ctx.$exists('title');
      assertType<readonly string[]>(keys);
      assertType<unknown>(interpolation);

      return ctx.messages[keys.join('.')];
    },
    {
      $exists(ctx, key?: string) {
        assertType<readonly string[]>(ctx.keys);
        assertType<Readonly<Record<string, string | undefined>>>(ctx.messages);
        assertType<string | undefined>(key);

        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
    },
  );
  const t = createT({
    loadingKeys: new Set(),
    messages: {},
  });

  assertType<string | undefined>(t.common.home.title());
  assertType<boolean>(t.common.home.title.$exists());
  assertType<boolean>(t.common.home.$exists('title'));

  // @ts-expect-error public extension calls do not accept the internal ctx argument
  t.common.home.$exists({ keys: [] });
});

test('types extension context and public extension arguments', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define(
    (ctx, keys) => {
      assertType<unknown>(ctx.$key());
      assertType<readonly string[]>(keys);

      return ctx.messages[keys.join('.')];
    },
    {
      $key(ctx, key?: string) {
        return appendKey(ctx.keys, key).join('.');
      },
      $exists(ctx, key?: string) {
        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
      $(ctx, key: string, interpolation?: object) {
        assertType<readonly string[]>(ctx.keys);
        assertType<string | undefined>(
          ctx.resolve(['common', 'home', 'title'], interpolation) as string | undefined,
        );

        return ctx.resolve(appendKey(ctx.keys, key), interpolation) as string | undefined;
      },
      $loading(ctx, key: string, priority?: number) {
        assertType<readonly string[]>(ctx.keys);
        assertType<string>(ctx.$key(key));
        assertType<ReadonlySet<string>>(ctx.loadingKeys);
        assertType<string>(key);
        assertType<number | undefined>(priority);

        return true;
      },
    },
  );
  const t = createT({
    loadingKeys: new Set(),
    messages: {},
  });

  assertType<string | undefined>(t.common.$('home.title'));
  assertType<string>(t.common.home.title.$key());
  assertType<boolean>(t.common.home.title.$exists());
  assertType<boolean>(t.common.home.$exists('title'));
  assertType<boolean>(t.common.home.$loading('title'));
  assertType<boolean>(t.common.home.$loading('title', 1));

  // @ts-expect-error extension argument must be a string
  t.common.home.$exists(1);

  // @ts-expect-error required extension argument is missing
  t.common.home.$loading();

  // @ts-expect-error extension argument must be a number
  t.common.home.$loading('title', 'high');

  // @ts-expect-error __call is not exposed as a path extension
  t.common.home.title.__call();
});

test('types non-dollar extension names as ordinary user-declared extensions', () => {
  const createT = tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define(
    (ctx, keys) => {
      assertType<unknown>(ctx._key());
      assertType<unknown>(ctx._exists('title'));

      return ctx.messages[keys.join('.')];
    },
    {
      _key(ctx, key?: string) {
        return appendKey(ctx.keys, key).join('.');
      },
      _exists(ctx, key?: string) {
        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
    },
  );
  const t = createT({
    messages: {},
  });

  assertType<string>(t.common.home.title._key());
  assertType<boolean>(t.common.home._exists('title'));

  // @ts-expect-error extension argument must be a string
  t.common.home._exists(1);
});

test('types symbol-keyed extensions alongside matching string translation keys', () => {
  const exists = Symbol('exists');
  const createT = tpath<
    TranslationCallsWithDollarKeys,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define(
    (ctx, keys) => ctx.messages[keys.join('.')],
    {
      [exists](ctx, key?: string) {
        assertType<readonly string[]>(ctx.keys);
        assertType<string | undefined>(key);

        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
    },
  );
  const t = createT({
    messages: {},
  });

  assertType<string | undefined>(t.common.home.$exists());
  assertType<boolean>(t.common.home[exists]('$exists'));
});

test('types __call as a path key when the translation tree declares it', () => {
  const createT = tpath<
    TranslationCallsWithDefinitionKey,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define((ctx, keys) => {
    assertType<string | undefined>(ctx.resolve(['common', 'home', '__call']));

    return ctx.messages[keys.join('.')];
  });
  const t = createT({
    messages: {},
  });

  assertType<string | undefined>(t.common.home.__call());
  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error __call is not exposed unless the path tree declares it
  t.common.home.title.__call();
});

test('does not expose a built-in format extension to the resolve function', () => {
  tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define((ctx) => {
    // @ts-expect-error definitions without extensions should call ctx.resolve, not format
    ctx.format(['common', 'home', 'title']);

    return ctx.messages[ctx.keys.join('.')];
  });
});

test('types shared context in formatter and extension context', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly debug: boolean;
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
      readonly strict: boolean;
    }
  >().define(
    (ctx) => {
      assertType<boolean>(ctx.debug);
      assertType<string>(ctx.locale);
      assertType<boolean>(ctx.strict);

      return formatWithDebug(ctx.keys, ctx);
    },
    {
      $locale(ctx) {
        assertType<boolean>(ctx.debug);
        assertType<string>(ctx.locale);
        assertType<boolean>(ctx.strict);

        return ctx.locale;
      },
      $strict(ctx, expected: boolean) {
        assertType<boolean>(ctx.strict);
        assertType<boolean>(expected);

        return ctx.strict === expected;
      },
    },
  );
  const t = createT({
    debug: true,
    locale: 'en',
    messages: {},
    strict: true,
  });

  assertType<string>(t.common.home.title.$locale());
  assertType<boolean>(t.common.home.title.$strict(true));

  // @ts-expect-error extension argument must be boolean
  t.common.home.title.$strict('yes');
});

test('preserves all fields in the declared context type', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define(
    (ctx) => {
      assertType<string>(ctx.locale);
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[ctx.keys.join('.')];
    },
    {
      $locale(ctx) {
        assertType<string>(ctx.locale);

        return ctx.locale;
      },
    },
  );

  const t = createT({
    locale: 'en',
    messages: {},
  });

  assertType<string>(t.common.home.title.$locale());

  // @ts-expect-error factory requires the complete declared context
  createT({ messages: {} });
});
