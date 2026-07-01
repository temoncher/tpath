import { afterEach, describe, expect, test, vi } from 'vitest';

import { tpath } from './tpath';

interface Translations {
  readonly common: {
    readonly home: {
      readonly title: 'Home';
      readonly greeting: 'Hello, {name}!';
      readonly score: '{name} has {score, number} points';
      readonly empty: '';
      readonly missing: 'Missing';
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
  options: { readonly debug: () => boolean },
): string {
  if (options.debug()) {
    return keys.join('.');
  }

  return 'Home';
}

describe('tpath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('passes collected keys to the caller-owned resolver', () => {
    const requestedKeys: string[][] = [];
    const messages = {
      'common.home.title': 'Home',
    };

    const t = tpath((keys: tpath.Keys<Translations>) => {
      requestedKeys.push([...keys]);

      return messages[keys.join('.') as keyof typeof messages];
    });

    expect(t.common.home.title()).toBe('Home');
    expect(requestedKeys).toEqual([['common', 'home', 'title']]);
  });

  test('formats ICU interpolation values', () => {
    const translations = {
      'common.home.greeting': 'Hello, {name}!',
      'common.home.score': '{name} has {score, number} points',
      'admin.users.count': '{count, plural, one {# user} other {# users}}',
    };
    const t = tpath(
      (keys: tpath.Keys<Translations>) => translations[keys.join('.') as keyof typeof translations],
    );

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.common.home.score({ name: 'Ada', score: 7 })).toBe('Ada has 7 points');
    expect(t.admin.users.count({ count: 2 })).toBe('2 users');
  });

  test('lets extensions call translate with caller-owned keys', () => {
    const translations = {
      'common.home.greeting': 'Hello, {name}!',
    };
    const t = tpath(
      (keys: tpath.Keys<Translations>) => translations[keys.join('.') as keyof typeof translations],
      {
        $({ keys, translate }, child: string, interpolation?: object) {
          return translate([...keys, child], interpolation);
        },
      },
    );

    expect(t.common.$('home.greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  test('lets extensions inspect current keys and resolve caller-owned keys', () => {
    const translations = {
      'common.home.empty': '',
      'common.home.title': 'Home',
    };
    const loadingKeys = new Set(['common.home.title']);
    const t = tpath(
      (keys: tpath.Keys<Translations>) => translations[keys.join('.') as keyof typeof translations],
      {
        $exists({ keys, resolve }, child?: string) {
          return resolve(appendKey(keys, child)) !== undefined;
        },
        $loading({ keys }, child?: string) {
          return loadingKeys.has(appendKey(keys, child).join('.'));
        },
      },
    );

    expect(t.common.home.empty.$exists()).toBe(true);
    expect(t.common.home.missing.$exists()).toBe(false);
    expect(t.common.home.title.$loading()).toBe(true);
    expect(t.common.home.$loading('title')).toBe(true);
  });

  test('passes user options into extension context', () => {
    const t = tpath(
      (_keys: tpath.Keys<Translations>) => 'Home',
      {
        $locale({ options }) {
          return options.locale;
        },
        $debug({ options }) {
          return options.debug();
        },
      },
      {
        debug: () => true,
        locale: 'en',
      },
    );

    expect(t.common.home.title.$locale()).toBe('en');
    expect(t.common.home.title.$debug()).toBe(true);
  });

  test('falls back to the joined key when a translation is missing', () => {
    const t = tpath((_keys: tpath.Keys<Translations>) => undefined);

    expect(t.common.home.title()).toBe('common.home.title');
  });

  test('lets the resolver implement debug mode from options', () => {
    const resolver =
      vi.fn<(keys: tpath.Keys<Translations>, options: { readonly debug: () => boolean }) => string>(
        resolveWithDebug,
      );
    const t = tpath(resolver, {}, { debug: () => true });

    expect(t.common.home.title()).toBe('common.home.title');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  test('reports ICU format errors and falls back to the joined key', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = tpath((_keys: tpath.Keys<Translations>) => 'Hello, {name');

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('common.home.greeting');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('ICU formatting error:'));
  });

  test('rejects symbol path keys', () => {
    const t = tpath((_keys: tpath.Keys<Translations>) => undefined);

    expect(() => {
      Reflect.get(t, Symbol('bad'));
    }).toThrow(TypeError);
  });
});
