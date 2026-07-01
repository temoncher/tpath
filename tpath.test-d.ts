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
  options: {
    readonly debug: () => boolean;
    readonly locale: string;
    readonly strict: boolean;
  },
): string {
  if (options.debug()) {
    return keys.join('.');
  }

  return 'value';
}

test('types nested translation paths', () => {
  const t = tpath((_keys: tpath.Keys<Translations>) => 'value');

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
  const t = tpath((_keys: tpath.Keys<Translations>) => 'value');

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

test('types extension context and public extension arguments', () => {
  const t = tpath(
    (keys: tpath.Keys<Translations>) => {
      expectTypeOf(keys).toEqualTypeOf<tpath.Keys<Translations>>();

      return 'value';
    },
    {
      $exists({ keys, resolve }, child?: string) {
        expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
        expectTypeOf(resolve).toEqualTypeOf<(keys: readonly string[]) => string | undefined>();

        return resolve(appendKey(keys, child)) !== undefined;
      },
      $loading({ keys }, child: string, priority?: number) {
        assertType<readonly string[]>(keys);
        assertType<string>(child);
        assertType<number | undefined>(priority);

        return true;
      },
    },
  );

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

test('types user options in extension context', () => {
  const t = tpath(
    (_keys: tpath.Keys<Translations>, options) => {
      assertType<() => boolean>(options.debug);
      assertType<string>(options.locale);
      assertType<boolean>(options.strict);

      return resolveWithDebug(_keys, options);
    },
    {
      $locale({ options }) {
        assertType<() => boolean>(options.debug);
        assertType<string>(options.locale);
        assertType<boolean>(options.strict);

        return options.locale;
      },
      $strict({ options }, expected: boolean) {
        assertType<boolean>(options.strict);
        assertType<boolean>(expected);

        return options.strict === expected;
      },
    },
    {
      debug: () => true,
      locale: 'en',
      strict: true,
    },
  );

  assertType<string>(t.common.home.title.$locale());
  assertType<boolean>(t.common.home.title.$strict(true));

  // @ts-expect-error extension argument must be boolean
  t.common.home.title.$strict('yes');
});

test('does not expose extensions that were not provided', () => {
  const t = tpath((_keys: tpath.Keys<Translations>) => 'value');

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
