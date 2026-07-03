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

type IsAny<T> = 0 extends 1 & T ? true : false;

function assertNotAny<T>(_value: IsAny<T> extends true ? never : T) {
  void _value;
}

test('contextually types ctx while inferring extension public arguments and return values', () => {
  const createT = tpath<TranslationCalls, { readonly factor: number }>()
    .extend({
      $tonum(ctx, key: string) {
        assertNotAny<typeof ctx>(ctx);
        assertNotAny<typeof key>(key);
        assertType<readonly string[]>(ctx.keys);
        assertType<number>(ctx.factor);
        assertType<string>(key);

        // @ts-expect-error later extensions are not visible to earlier extensions
        ctx.$otherExt(1);

        return Number(key) * ctx.factor;
      },
    })
    .extend({
      $otherExt(ctx, someNumber: number) {
        assertNotAny<typeof ctx>(ctx);
        assertNotAny<typeof someNumber>(someNumber);
        assertType<(key: string) => number>(ctx.$tonum);
        assertType<number>(ctx.$tonum('42'));
        assertType<number>(someNumber);

        // @ts-expect-error previous extension argument must be a string
        ctx.$tonum(42);

        return ctx.$tonum('42') + someNumber;
      },
    })
    .define((ctx, keys, interpolation) => {
      assertNotAny<typeof ctx>(ctx);
      assertNotAny<typeof keys>(keys);
      assertNotAny<typeof interpolation>(interpolation);
      assertType<readonly string[]>(keys);
      assertType<unknown>(interpolation);
      assertType<number>(ctx.$tonum('42'));
      assertType<number>(ctx.$otherExt(42));

      return keys.join('.');
    });
  const t = createT({ factor: 2 });

  assertType<number>(t.common.home.title.$tonum('42'));
  assertType<number>(t.common.home.title.$otherExt(42));

  // @ts-expect-error public extension calls do not accept the internal ctx argument
  t.common.home.title.$tonum({ keys: [] }, '42');

  // @ts-expect-error extension argument must be a string
  t.common.home.title.$tonum(42);

  // @ts-expect-error extension argument must be a number
  t.common.home.title.$otherExt('42');
});

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

test('exports ctx-first resolve and context types for extracted callbacks', () => {
  type Resolve = tpath.DefinitionResolve<
    { readonly messages: Readonly<Record<string, string | undefined>> },
    {}
  >;
  type Context = tpath.DefinitionContext<
    { readonly messages: Readonly<Record<string, string | undefined>> },
    {}
  >;

  const resolve: Resolve = (ctx, keys) => {
    expectTypeOf(ctx).toEqualTypeOf<Context>();
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

test('types multiple extension layers and terminal resolve context', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >()
    .extend({
      $key(ctx, key?: string) {
        assertNotAny<typeof ctx>(ctx);
        assertNotAny<typeof key>(key);
        assertType<readonly string[]>(ctx.keys);
        assertType<Readonly<Record<string, string | undefined>>>(ctx.messages);
        assertType<string | undefined>(key);

        return appendKey(ctx.keys, key).join('.');
      },
    })
    .extend({
      $loading(ctx, key?: string) {
        assertNotAny<typeof ctx>(ctx);
        assertType<readonly string[]>(ctx.keys);
        assertType<string>(ctx.$key(key));
        assertType<ReadonlySet<string>>(ctx.loadingKeys);
        assertType<string | undefined>(key);

        return ctx.loadingKeys.has(ctx.$key(key));
      },
    })
    .extend({
      $(ctx, key: string, interpolation?: object) {
        assertNotAny<typeof ctx>(ctx);
        assertNotAny<typeof key>(key);
        assertNotAny<typeof interpolation>(interpolation);
        assertType<string | undefined>(
          ctx.resolve(['common', 'home', 'title'], interpolation) as string | undefined,
        );

        return ctx.resolve(appendKey(ctx.keys, key), interpolation) as string | undefined;
      },
    })
    .define((ctx, keys, interpolation) => {
      assertNotAny<typeof ctx>(ctx);
      assertNotAny<typeof keys>(keys);
      assertNotAny<typeof interpolation>(interpolation);
      assertType<readonly string[]>(keys);
      assertType<unknown>(interpolation);
      assertType<readonly string[]>(ctx.keys);
      assertType<string>(ctx.$key());
      assertType<boolean>(ctx.$loading());
      assertType<Readonly<Record<string, string | undefined>>>(ctx.messages);

      return ctx.messages[keys.join('.')];
    });
  const t = createT({
    loadingKeys: new Set(['common.home.title']),
    messages: {},
  });

  assertType<string | undefined>(t.common.$('home.title'));
  assertType<string>(t.common.home.title.$key());
  assertType<boolean>(t.common.home.title.$loading());

  // @ts-expect-error public extension calls do not accept the internal ctx argument
  t.common.home.$key({ keys: [] });

  // @ts-expect-error extension argument must be a string
  t.common.home.$loading(1);
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

  // @ts-expect-error no context argument is accepted without declaring context
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

test('types non-dollar extension names as ordinary user-declared extensions', () => {
  const createT = tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >()
    .extend({
      _key(ctx, key?: string) {
        return appendKey(ctx.keys, key).join('.');
      },
    })
    .extend({
      _exists(ctx, key?: string) {
        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
    })
    .define((ctx, keys) => {
      assertType<string>(ctx._key());
      assertType<boolean>(ctx._exists('title'));

      return ctx.messages[keys.join('.')];
    });
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
  >()
    .extend({
      [exists](ctx, key?: string) {
        assertType<readonly string[]>(ctx.keys);
        assertType<string | undefined>(key);

        return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
      },
    })
    .define((ctx, keys) => ctx.messages[keys.join('.')]);
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

test('types shared context in resolver and extension ctx', () => {
  const createT = tpath<
    TranslationCalls,
    {
      readonly debug: boolean;
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
      readonly strict: boolean;
    }
  >()
    .extend({
      $locale(ctx) {
        assertType<boolean>(ctx.debug);
        assertType<string>(ctx.locale);
        assertType<boolean>(ctx.strict);

        return ctx.locale;
      },
    })
    .extend({
      $strict(ctx, expected: boolean) {
        assertType<boolean>(ctx.strict);
        assertType<boolean>(expected);

        return ctx.strict === expected;
      },
    })
    .define((ctx) => {
      assertType<boolean>(ctx.debug);
      assertType<string>(ctx.locale);
      assertType<boolean>(ctx.strict);

      return formatWithDebug(ctx.keys, ctx);
    });
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
  >()
    .extend({
      $locale(ctx) {
        assertType<string>(ctx.locale);

        return ctx.locale;
      },
    })
    .define((ctx) => {
      assertType<string>(ctx.locale);
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[ctx.keys.join('.')];
    });

  const t = createT({
    locale: 'en',
    messages: {},
  });

  assertType<string>(t.common.home.title.$locale());

  // @ts-expect-error factory requires the complete declared context
  createT({ messages: {} });
});
