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
  const t = tpath<Translations>().format(() => 'value')();

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
  const t = tpath<Translations>().format(() => 'value')();

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
  const createT = tpath<Translations>().format(() => 'value');
  const t = createT();

  assertType<string | undefined>(t.common.home.title());

  // @ts-expect-error no context argument is accepted without .ctx()
  createT({});
});

test('treats an empty factory context as no context argument', () => {
  type Factory = tpath.Factory<Translations, {}, {}>;
  type T = tpath.TPath<Translations, {}>;

  expectTypeOf<Factory>().toEqualTypeOf<(ctx?: never) => T>();
});

test('formats values through a required formatter instead of resolve', () => {
  const createT = tpath<Translations>()
    .ctx<{
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .format(({ ctx, interpolation, keys }) => {
      expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
      expectTypeOf(interpolation).toEqualTypeOf<object | undefined>();
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[keys.join('.')];
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
});

test('types extension context and public extension arguments', () => {
  const t = tpath<Translations>()
    .ctx<{
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .extend({
      $({ format, keys }, child: string, interpolation?: object) {
        expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(format).toEqualTypeOf<
          (keys: readonly string[], interpolation?: object) => string | undefined
        >();

        return format(appendKey(keys, child), interpolation);
      },
      $exists({ ctx, keys }, child?: string) {
        return ctx.messages[appendKey(keys, child).join('.')] !== undefined;
      },
      $loading({ ctx, keys }, child: string, priority?: number) {
        assertType<readonly string[]>(keys);
        expectTypeOf(ctx.loadingKeys).toEqualTypeOf<ReadonlySet<string>>();
        assertType<string>(child);
        assertType<number | undefined>(priority);

        return true;
      },
    })
    .format(({ ctx, keys }) => ctx.messages[keys.join('.')])({
    loadingKeys: new Set(),
    messages: {},
  });

  assertType<string | undefined>(t.common.$('home.title'));
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
});

test('types shared context in formatter and extension context', () => {
  const t = tpath<Translations>()
    .ctx<{
      readonly debug: boolean;
      readonly locale: string;
      readonly messages: Readonly<Record<string, string | undefined>>;
      readonly strict: boolean;
    }>()
    .extend({
      $locale({ ctx }) {
        assertType<boolean>(ctx.debug);
        assertType<string>(ctx.locale);
        assertType<boolean>(ctx.strict);

        return ctx.locale;
      },
      $strict({ ctx }, expected: boolean) {
        assertType<boolean>(ctx.strict);
        assertType<boolean>(expected);

        return ctx.strict === expected;
      },
    })
    .format(({ ctx, keys }) => {
      assertType<boolean>(ctx.debug);
      assertType<string>(ctx.locale);
      assertType<boolean>(ctx.strict);

      return formatWithDebug(keys, ctx);
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
    .extend({
      $locale({ ctx }) {
        assertType<string>(ctx.locale);

        return ctx.locale;
      },
    })
    .ctx<{
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .format(({ ctx, keys }) => {
      assertType<string>(ctx.locale);
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[keys.join('.')];
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
  const t = tpath<Translations>().format(() => 'value')();

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
