import { afterEach, describe, expect, test, vi } from 'vitest';

import { tpath } from './tpath';

interface Translations {
  readonly common: {
    readonly home: {
      readonly title: 'Home';
      readonly greeting: 'Hello, {name}!';
      readonly score: '{name} has {score, number} points';
      readonly empty: '';
    };
  };
  readonly admin: {
    readonly users: {
      readonly count: '{count, plural, one {# user} other {# users}}';
    };
  };
}

describe('tpath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('passes collected path keys to the caller-owned lookup', () => {
    const requestedKeys: string[][] = [];
    const dictionaries = {
      common: {
        'home.title': 'Home',
      },
    } as Record<string, Record<string, string>>;

    const t = tpath<Translations>((keys) => {
      requestedKeys.push([...keys]);

      return dictionaries[keys[0] as string]?.[keys.slice(1).join('.')];
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
    const t = tpath<Translations>(
      (keys) => translations[keys.join('.') as keyof typeof translations],
    );

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.common.home.score({ name: 'Ada', score: 7 })).toBe('Ada has 7 points');
    expect(t.admin.users.count({ count: 2 })).toBe('2 users');
  });

  test('lets unsafe calls pass dynamic keys through the same lookup', () => {
    const translations = {
      'common.home.title': 'Home',
    };
    const t = tpath<Translations>(
      (keys) => translations[keys.join('.') as keyof typeof translations],
    );

    expect(t.$('common.home.title')).toBe('Home');
    expect(t.common.$('home.title')).toBe('Home');
  });

  test('checks existence without treating empty translations as missing', () => {
    const translations = {
      'common.home.empty': '',
    };
    const t = tpath<Translations>(
      (keys) => translations[keys.join('.') as keyof typeof translations],
    );

    expect(t.common.home.empty.$exists()).toBe(true);
    expect(t.common.home.title.$exists()).toBe(false);
    expect(t.$exists('common.home.empty')).toBe(true);
  });

  test('falls back to the joined key when a translation is missing', () => {
    const t = tpath<Translations>(() => undefined);

    expect(t.common.home.title()).toBe('common.home.title');
    expect(t.$('common.home.title')).toBe('common.home.title');
  });

  test('returns the key in debug mode without reading translations', () => {
    const lookup = vi.fn<Parameters<typeof tpath>[0]>(() => 'Home');
    const t = tpath<Translations>(lookup, { debug: () => true });

    expect(t.common.home.title()).toBe('common.home.title');
    expect(lookup).not.toHaveBeenCalled();
  });

  test('reports ICU format errors and falls back to the joined key', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = tpath<Translations>(() => 'Hello, {name');

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('common.home.greeting');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('ICU formatting error:'));
  });

  test('rejects symbol path keys', () => {
    const t = tpath<Translations>(() => undefined);

    expect(() => {
      Reflect.get(t, Symbol('bad'));
    }).toThrow(TypeError);
  });
});
