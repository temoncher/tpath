import { assertType, expectTypeOf, test } from 'vitest';

import { tpath } from './tpath';

interface Translations {
  readonly common: {
    readonly home: {
      readonly title: 'Home';
      readonly greeting: 'Hello, {name}!';
      readonly score: '{name} has {score, number} points';
    };
  };
  readonly admin: {
    readonly users: {
      readonly count: '{count, plural, one {# user} other {# users}}';
    };
  };
}

function appendKey(keys: readonly string[], child: string | undefined): readonly string[] {
  if (child === undefined) {
    return keys;
  }

  return [...keys, child];
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

test('types nested translation paths', () => {
  const t = tpath<Translations>().define({
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
  const t = tpath<Translations>().define({
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
  const createT = tpath<Translations>().define({
    __call() {
      return 'value';
    },
  });
  const t = createT();

  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error no context argument is accepted without .ctx()
  createT({});
});

test('treats an empty factory context as no context argument', () => {
  type Factory = tpath.Factory<
    Translations,
    {},
    { readonly __call: (ctx: tpath.DefinitionContext<{}, {}>) => string | undefined }
  >;
  type T = tpath.TPath<Translations, {}>;

  expectTypeOf<Factory>().toEqualTypeOf<(ctx?: never) => T>();
});

test('formats values through a required __call definition instead of resolve', () => {
  const createT = tpath<Translations>()
    .ctx<{
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .define({
      __call(ctx, keys, interpolation) {
        expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(interpolation).toEqualTypeOf<object | undefined>();
        expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

        return ctx.messages[keys.join('.')];
      },
    });

  const t = createT({
    messages: {
      'common.home.title': 'Home',
    },
  });

  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error factory requires the declared context
  createT();

  // @ts-expect-error missing context property
  createT({});

  // @ts-expect-error resolve is not part of the builder API
  tpath<Translations>().resolve(() => 'value');

  // @ts-expect-error format is not part of the builder API
  tpath<Translations>().format(() => 'value');

  // @ts-expect-error extend is not part of the builder API
  tpath<Translations>().extend({});

  // @ts-expect-error define requires __call
  tpath<Translations>().define({})();

  // @ts-expect-error a builder cannot create translators before define is called
  tpath<Translations>()();
});

test('types ctx-first definition functions', () => {
  const t = tpath<Translations>()
    .ctx<{
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .define({
      $exists(ctx, child?: string) {
        expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();
        assertType<string | undefined>(child);

        return ctx.messages[appendKey(ctx.keys, child).join('.')] !== undefined;
      },
      __call(ctx, keys, interpolation) {
        expectTypeOf(ctx.__call).toEqualTypeOf<
          (keys: readonly string[], interpolation?: object) => string | undefined
        >();
        // @ts-expect-error explicit keys now go through ctx.__call
        assertType<unknown>(ctx.__callAt);
        ctx.$exists('title');
        assertType<readonly string[]>(keys);
        assertType<object | undefined>(interpolation);

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
  const t = tpath<Translations>()
    .ctx<{
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .define({
      $key(ctx, child?: string) {
        return appendKey(ctx.keys, child).join('.');
      },
      $exists(ctx, child?: string) {
        return ctx.messages[appendKey(ctx.keys, child).join('.')] !== undefined;
      },
      __call(ctx, keys) {
        assertType<string>(ctx.$key());
        assertType<readonly string[]>(keys);

        return ctx.messages[keys.join('.')];
      },
      $(ctx, child: string, interpolation?: object) {
        expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.__call).toEqualTypeOf<
          (keys: readonly string[], interpolation?: object) => string | undefined
        >();

        return ctx.__call(appendKey(ctx.keys, child), interpolation);
      },
      $loading(ctx, child: string, priority?: number) {
        assertType<readonly string[]>(ctx.keys);
        assertType<string>(ctx.$key(child));
        expectTypeOf(ctx.loadingKeys).toEqualTypeOf<ReadonlySet<string>>();
        assertType<string>(child);
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
  tpath<Translations>()
    .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
    .define({
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
  const t = tpath<Translations>()
    .ctx<{
      readonly debug: boolean;
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
      readonly strict: boolean;
    }>()
    .define({
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

test('preserves context declared before later context declarations', () => {
  const createT = tpath<Translations>()
    .ctx<{
      readonly locale: string;
    }>()
    .ctx<{
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .define({
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

  // @ts-expect-error factory still requires context declared before extensions
  createT({ messages: {} });
});

test('does not expose extensions that were not provided', () => {
  const t = tpath<Translations>().define({
    __call() {
      return 'value';
    },
  })();

  // @ts-expect-error $exists is not built in
  t.common.home.title.$exists();

  // @ts-expect-error $ is not built in
  t.$('common.home.title');
});

test('picks selected namespaces', () => {
  type Picked = tpath.PickNs<Translations, ['common']>;

  expectTypeOf<Picked>().toEqualTypeOf<{
    readonly common: Translations['common'];
  }>();
});
