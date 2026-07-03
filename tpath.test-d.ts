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
  const p = tpath<ApiPaths>().define({
    __call() {
      return undefined;
    },
  })();

  assertType<Promise<User>>(p.users.byId('42'));
  assertType<readonly User[]>(p.users.search('ada', 10));
  assertType<readonly User[]>(p.users.search('ada'));
  assertType<Config>(p.config.current());

  // @ts-expect-error missing leaf argument
  p.users.byId();

  // @ts-expect-error wrong leaf argument type
  p.users.search(1);
});

test('types nested translation paths', () => {
  const t = tpath<TranslationCalls>().define({
    __call() {
      return 'value';
    },
  })();

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
  const t = tpath<TranslationCalls>().define({
    __call() {
      return 'value';
    },
  })();

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
  const createT = tpath<TranslationCalls>().define({
    __call() {
      return 'value';
    },
  });
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
  >().define({
    __call(ctx, keys, interpolation) {
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
      expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
      assertType<unknown>(interpolation);

      return ctx.messages[keys.join('.')];
    },
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

test('treats an empty factory context as no context argument', () => {
  type Factory = tpath.Factory<
    TranslationCalls,
    {},
    { readonly __call: (ctx: tpath.DefinitionContext<{}, {}>) => string | undefined }
  >;
  type T = tpath.TPath<TranslationCalls, {}>;

  expectTypeOf<Factory>().toEqualTypeOf<(ctx?: never) => T>();
});

test('types ctx-first definition functions', () => {
  const t = tpath<
    TranslationCalls,
    {
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define({
    $exists(ctx, key?: string) {
      expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
      assertType<string | undefined>(key);

      return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
    },
    __call(ctx, keys, interpolation) {
      assertType<string | undefined>(
        ctx.__call<string | undefined>(['common', 'home', 'title'], interpolation),
      );
      // @ts-expect-error explicit keys now go through ctx.__call
      assertType<unknown>(ctx.__callAt);
      ctx.$exists('title');
      assertType<readonly string[]>(keys);
      assertType<unknown>(interpolation);

      return ctx.messages[keys.join('.')];
    },
  })({
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
  const t = tpath<
    TranslationCalls,
    {
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }
  >().define({
    $key(ctx, key?: string) {
      return appendKey(ctx.keys, key).join('.');
    },
    $exists(ctx, key?: string) {
      return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
    },
    __call(ctx, keys) {
      assertType<string>(ctx.$key());
      assertType<readonly string[]>(keys);

      return ctx.messages[keys.join('.')];
    },
    $(ctx, key: string, interpolation?: object) {
      expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();
      assertType<string | undefined>(
        ctx.__call<string | undefined>(['common', 'home', 'title'], interpolation),
      );

      return ctx.__call<string | undefined>(appendKey(ctx.keys, key), interpolation);
    },
    $loading(ctx, key: string, priority?: number) {
      assertType<readonly string[]>(ctx.keys);
      assertType<string>(ctx.$key(key));
      expectTypeOf(ctx.loadingKeys).toEqualTypeOf<ReadonlySet<string>>();
      assertType<string>(key);
      assertType<number | undefined>(priority);

      return true;
    },
  })({
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

test('does not expose a built-in format helper to definitions', () => {
  tpath<
    TranslationCalls,
    { readonly messages: Readonly<Record<string, string | undefined>> }
  >().define({
    $(ctx): string | undefined {
      // @ts-expect-error definitions should call ctx.__call, not format
      return ctx.format(['common', 'home', 'title']);
    },
    __call(ctx) {
      return ctx.messages[ctx.keys.join('.')];
    },
  });
});

test('types shared context in formatter and extension context', () => {
  const t = tpath<
    TranslationCalls,
    {
      readonly debug: boolean;
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
      readonly strict: boolean;
    }
  >().define({
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
    __call(ctx) {
      assertType<boolean>(ctx.debug);
      assertType<string>(ctx.locale);
      assertType<boolean>(ctx.strict);

      return formatWithDebug(ctx.keys, ctx);
    },
  })({
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
  >().define({
    $locale(ctx) {
      assertType<string>(ctx.locale);

      return ctx.locale;
    },
    __call(ctx) {
      assertType<string>(ctx.locale);
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[ctx.keys.join('.')];
    },
  });

  const t = createT({
    locale: 'en',
    messages: {},
  });

  assertType<string>(t.common.home.title.$locale());

  // @ts-expect-error factory requires the complete declared context
  createT({ messages: {} });
});
