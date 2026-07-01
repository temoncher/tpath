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

test('types nested translation paths', () => {
  const t = tpath<Translations>(() => 'value');

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
  const t = tpath<Translations>(() => 'value');

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

test('types unsafe helpers and lookup keys', () => {
  const t = tpath<Translations>((keys) => {
    expectTypeOf(keys).toEqualTypeOf<readonly string[]>();

    return keys.join('.');
  });

  assertType<string>(t.$('anything.dynamic', { value: 1 }));
  assertType<boolean>(t.$exists('anything.dynamic'));
  assertType<boolean>(t.common.home.title.$exists());
});

test('picks selected namespaces', () => {
  type Picked = tpath.PickNs<Translations, ['common']>;

  expectTypeOf<Picked>().toEqualTypeOf<{
    readonly common: Translations['common'];
  }>();
});
