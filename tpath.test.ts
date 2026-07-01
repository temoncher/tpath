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

  return ctx.messages[keys.join('.')];
}

function lookupAndFormat(
  keys: readonly string[],
  ctx: {
    readonly formatter: {
      readonly format: (message: string, interpolation?: object) => string;
    };
    readonly messages: Readonly<Record<string, string | undefined>>;
  },
  interpolation: object | undefined,
): string | undefined {
  const message = ctx.messages[keys.join('.')];

  if (message === undefined) {
    return undefined;
  }

  return ctx.formatter.format(message, interpolation);
}

describe('tpath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('passes collected keys to the caller-owned formatter', () => {
    const requestedKeys: string[][] = [];
    const messages = {
      'common.home.title': 'Home',
    };

    const createT = tpath<Translations>()
      .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
      .format(({ ctx, keys }) => {
        requestedKeys.push([...keys]);

        return ctx.messages[keys.join('.')];
      });
    const t = createT({ messages });

    expect(t.common.home.title()).toBe('Home');
    expect(requestedKeys).toEqual([['common', 'home', 'title']]);
  });

  test('binds translation context when creating a proxy', () => {
    const createT = tpath<Translations>()
      .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
      .format(({ ctx, keys }) => ctx.messages[keys.join('.')]);

    const en = createT({ messages: { 'common.home.title': 'Home' } });
    const alternate = createT({ messages: { 'common.home.title': 'Start' } });

    expect(en.common.home.title()).toBe('Home');
    expect(alternate.common.home.title()).toBe('Start');
  });

  test('formats interpolation with a caller-owned formatter from context', () => {
    const messages = {
      'common.home.greeting': 'Hello, {name}!',
      'common.home.score': '{name} has {score, number} points',
      'admin.users.count': '{count, plural, one {# user} other {# users}}',
    };
    const formatMessages: Readonly<Record<string, (interpolation?: object) => string>> = {
      'Hello, {name}!'(interpolation) {
        return `Hello, ${(interpolation as { readonly name: string }).name}!`;
      },
      '{count, plural, one {# user} other {# users}}'(interpolation) {
        const count = (interpolation as { readonly count: number }).count;

        return `${count} users`;
      },
      '{name} has {score, number} points'(interpolation) {
        const values = interpolation as { readonly name: string; readonly score: number };

        return `${values.name} has ${values.score} points`;
      },
    };
    const formatter = {
      format(message: string, interpolation?: object) {
        return formatMessages[message as keyof typeof formatMessages](interpolation);
      },
    };
    const t = tpath<Translations>()
      .ctx<{
        readonly formatter: typeof formatter;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }>()
      .format(({ ctx, interpolation, keys }) => lookupAndFormat(keys, ctx, interpolation))({
      formatter,
      messages,
    });

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.common.home.score({ name: 'Ada', score: 7 })).toBe('Ada has 7 points');
    expect(t.admin.users.count({ count: 2 })).toBe('2 users');
  });

  test('lets extensions call format with caller-owned keys', () => {
    const messages = {
      'common.home.greeting': 'Hello, {name}!',
    };
    const t = tpath<Translations>()
      .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
      .extend({
        $({ format, keys }, child: string, interpolation?: object) {
          return format([...keys, child], interpolation);
        },
      })
      .format(({ ctx, interpolation, keys }) => {
        const message = ctx.messages[keys.join('.')];
        const values = interpolation as { readonly name: string };

        return message?.replace('{name}', values.name);
      })({ messages });

    expect(t.common.$('home.greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  test('lets extensions inspect current keys and caller-owned context', () => {
    const messages = {
      'common.home.empty': '',
      'common.home.title': 'Home',
    };
    const loadingKeys = new Set(['common.home.title']);
    const t = tpath<Translations>()
      .ctx<{
        readonly loadingKeys: ReadonlySet<string>;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }>()
      .extend({
        $exists({ ctx, keys }, child?: string) {
          return ctx.messages[appendKey(keys, child).join('.')] !== undefined;
        },
        $loading({ ctx, keys }, child?: string) {
          return ctx.loadingKeys.has(appendKey(keys, child).join('.'));
        },
      })
      .format(({ ctx, keys }) => ctx.messages[keys.join('.')])({
      loadingKeys,
      messages,
    });

    expect(t.common.home.empty.$exists()).toBe(true);
    expect(t.common.home.missing.$exists()).toBe(false);
    expect(t.common.home.title.$loading()).toBe(true);
    expect(t.common.home.$loading('title')).toBe(true);
  });

  test('passes bound context into extension context', () => {
    const t = tpath<Translations>()
      .ctx<{
        readonly debug: boolean;
        readonly locale: string;
      }>()
      .extend({
        $locale({ ctx }) {
          return ctx.locale;
        },
        $debug({ ctx }) {
          return ctx.debug;
        },
      })
      .format(() => 'Home')({
      debug: true,
      locale: 'en',
    });

    expect(t.common.home.title.$locale()).toBe('en');
    expect(t.common.home.title.$debug()).toBe(true);
  });

  test('returns undefined when the caller-owned formatter returns no translation', () => {
    const t = tpath<Translations>().format(() => undefined)();

    expect(t.common.home.title()).toBeUndefined();
  });

  test('lets the formatter implement debug mode from context', () => {
    const formatter = vi.fn<
      (context: {
        readonly ctx: {
          readonly debug: boolean;
          readonly messages: Readonly<Record<string, string | undefined>>;
        };
        readonly keys: readonly string[];
      }) => string | undefined
    >(({ ctx, keys }) => formatWithDebug(keys, ctx));
    const t = tpath<Translations>()
      .ctx<{
        readonly debug: boolean;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }>()
      .format(formatter)({ debug: true, messages: {} });

    expect(t.common.home.title()).toBe('common.home.title');
    expect(formatter).toHaveBeenCalledTimes(1);
  });

  test('lets formatter errors propagate to the caller', () => {
    const t = tpath<Translations>().format(() => {
      throw new Error('formatter failed');
    })();

    expect(() => t.common.home.greeting({ name: 'Ada' })).toThrow('formatter failed');
  });

  test('rejects symbol path keys', () => {
    const t = tpath<Translations>().format(() => undefined)();

    expect(() => {
      Reflect.get(t, Symbol('bad'));
    }).toThrow(TypeError);
  });
});
