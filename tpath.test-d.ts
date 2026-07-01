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

function resolveWithDebug(
  keys: tpath.Keys<Translations>,
  ctx: {
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  },
): string {
  if (ctx.debug) {
    return keys.join('.');
  }

  return ctx.messages[keys.join('.')] ?? 'value';
}

test('types nested translation paths', () => {
  const t = tpath<Translations>().resolve(() => 'value')();

  assertType<string>(t.common.home.title());
  assertType<string>(t.common.home.greeting({ name: 'Ada' }));
  assertType<string>(t.common.home.score({ name: 'Ada', score: 7 }));
  assertType<string>(t.admin.users.count({ count: 2 }));

  // @ts-expect-error missing namespace
  assertType<unknown>(t.missing);

  // @ts-expect-error missing nested key
  assertType<unknown>(t.common.missing);
});

test('requires interpolation only for messages that declare it', () => {
  const t = tpath<Translations>().resolve(() => 'value')();

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
  const createT = tpath<Translations>().resolve(() => 'value');
  const t = createT();

  assertType<string>(t.common.home.title());

  // @ts-expect-error no context argument is accepted without .ctx()
  createT({});
});

test('types resolver context and factory argument', () => {
  const createT = tpath<Translations>()
    .ctx<{
      readonly debug: boolean;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .resolve((keys, ctx) => {
      expectTypeOf(keys).toEqualTypeOf<tpath.Keys<Translations>>();
      assertType<boolean>(ctx.debug);
      expectTypeOf(ctx.messages).toEqualTypeOf<Readonly<Record<string, string | undefined>>>();

      return ctx.messages[keys.join('.')];
    });

  const t = createT({
    debug: false,
    messages: {
      'common.home.title': 'Home',
    },
  });

  assertType<string>(t.common.home.title());

  // @ts-expect-error factory requires the declared context
  createT();

  // @ts-expect-error missing context property
  createT({ debug: false });
});

test('types extension context and public extension arguments', () => {
  const t = tpath<Translations>()
    .ctx<{
      readonly loadingKeys: ReadonlySet<string>;
      readonly messages: Readonly<Record<string, string | undefined>>;
    }>()
    .extend({
      $exists({ keys, resolve }, child?: string) {
        expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(resolve).toEqualTypeOf<(keys: readonly string[]) => string | undefined>();

        return resolve(appendKey(keys, child)) !== undefined;
      },
      $loading({ ctx, keys }, child: string, priority?: number) {
        assertType<readonly string[]>(keys);
        expectTypeOf(ctx.loadingKeys).toEqualTypeOf<ReadonlySet<string>>();
        assertType<string>(child);
        assertType<number | undefined>(priority);

        return true;
      },
    })
    .resolve((keys, ctx) => ctx.messages[keys.join('.')])({
    loadingKeys: new Set(),
    messages: {},
  });

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

test('types shared context in resolver and extension context', () => {
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
    .resolve((keys, ctx) => {
      assertType<boolean>(ctx.debug);
      assertType<string>(ctx.locale);
      assertType<boolean>(ctx.strict);

      return resolveWithDebug(keys, ctx);
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

test('does not expose extensions that were not provided', () => {
  const t = tpath<Translations>().resolve(() => 'value')();

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
