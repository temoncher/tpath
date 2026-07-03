import { afterEach, describe, expect, test, vi } from 'vitest';

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
      readonly empty: () => string | undefined;
      readonly missing: () => string | undefined;
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

interface ApiPaths {
  readonly users: {
    readonly byId: (id: string) => User;
    readonly search: (query: string, limit?: number) => readonly User[];
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

  test('defines the terminal resolver after accumulated extensions', () => {
    const messages = {
      'common.home.greeting': 'Hello, {name}!',
    };
    const createT = tpath<
      TranslationCalls,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >()
      .extend({
        $(ctx, key: string, interpolation?: object) {
          return ctx.resolve([...ctx.keys, key], interpolation) as string | undefined;
        },
      })
      .define((ctx, keys, interpolation) => {
        const message = ctx.messages[keys.join('.')];
        const values = interpolation as { readonly name: string };

        return message?.replace('{name}', values.name);
      });
    const t = createT({ messages });

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.common.$('home.greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  test('forwards all leaf arguments to the caller-owned definition', () => {
    const createP = tpath<ApiPaths>()
      .extend({
        $key(ctx, key: string) {
          return [...ctx.keys, key].join('.');
        },
      })
      .define((_ctx, keys: readonly string[], ...args: unknown[]) => ({
        args,
        keys,
      }));
    const p = createP();

    expect(p.users.search('ada', 2)).toEqual({
      args: ['ada', 2],
      keys: ['users', 'search'],
    });
    expect(p.users.$key('byId')).toBe('users.byId');
  });

  test('passes definition context as the first argument', () => {
    const requestedKeys: string[][] = [];
    const messages = {
      'common.home.title': 'Home',
    };

    const createT = tpath<
      TranslationCalls,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >().define((ctx) => {
      requestedKeys.push([...ctx.keys]);

      return ctx.messages[ctx.keys.join('.')];
    });
    const t = createT({ messages });

    expect(t.common.home.title()).toBe('Home');
    expect(requestedKeys).toEqual([['common', 'home', 'title']]);
  });

  test('passes collected keys as an explicit resolve argument', () => {
    const requestedKeys: string[][] = [];
    const messages = {
      'common.home.title': 'Home',
    };

    const createT = tpath<
      TranslationCalls,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >().define((ctx, keys) => {
      requestedKeys.push([...keys]);

      return ctx.messages[keys.join('.')];
    });
    const t = createT({ messages });

    expect(t.common.home.title()).toBe('Home');
    expect(requestedKeys).toEqual([['common', 'home', 'title']]);
  });

  test('binds translation context when creating a proxy', () => {
    const createT = tpath<
      TranslationCalls,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >().define((ctx) => ctx.messages[ctx.keys.join('.')]);

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
    const createT = tpath<
      TranslationCalls,
      {
        readonly formatter: typeof formatter;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }
    >().define((ctx, keys, interpolation) =>
      lookupAndFormat(keys, ctx, interpolation as object | undefined),
    );
    const t = createT({
      formatter,
      messages,
    });

    expect(t.common.home.greeting({ name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.common.home.score({ name: 'Ada', score: 7 })).toBe('Ada has 7 points');
    expect(t.admin.users.count({ count: 2 })).toBe('2 users');
  });

  test('lets extensions resolve caller-owned keys', () => {
    const messages = {
      'common.home.greeting': 'Hello, {name}!',
    };
    const createT = tpath<
      TranslationCalls,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >()
      .extend({
        $(ctx, key: string, interpolation?: object) {
          return ctx.resolve([...ctx.keys, key], interpolation) as string | undefined;
        },
      })
      .define((ctx, keys, interpolation) => {
        const message = ctx.messages[keys.join('.')];
        const values = interpolation as { readonly name: string };

        return message?.replace('{name}', values.name);
      });
    const t = createT({ messages });

    expect(t.common.$('home.greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  test('lets later extensions reuse earlier extensions', () => {
    const loadingKeys = new Set(['common.home.title']);
    const createT = tpath<TranslationCalls, { readonly loadingKeys: ReadonlySet<string> }>()
      .extend({
        $key(ctx, key?: string) {
          return appendKey(ctx.keys, key).join('.');
        },
      })
      .extend({
        $loading(ctx, key?: string) {
          return ctx.loadingKeys.has(ctx.$key(key));
        },
      })
      .define((ctx) => ctx.$key());
    const t = createT({ loadingKeys });

    expect(t.common.home.title.$key()).toBe('common.home.title');
    expect(t.common.home.title()).toBe('common.home.title');
    expect(t.common.home.$key('title')).toBe('common.home.title');
    expect(t.common.home.title.$loading()).toBe(true);
    expect(t.common.home.$loading('title')).toBe(true);
  });

  test('lets the terminal resolver reuse all declared extensions', () => {
    const loadingKeys = new Set(['common.home.title']);
    const messages = {
      'common.home.title': 'Home',
    };
    const createT = tpath<
      TranslationCalls,
      {
        readonly loadingKeys: ReadonlySet<string>;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }
    >()
      .extend({
        $key(ctx, key?: string) {
          return appendKey(ctx.keys, key).join('.');
        },
      })
      .extend({
        $loading(ctx, key?: string) {
          return ctx.loadingKeys.has(ctx.$key(key));
        },
      })
      .define((ctx, keys) => `${ctx.$loading()}:${ctx.messages[keys.join('.')]}`);
    const t = createT({ loadingKeys, messages });

    expect(t.common.home.title()).toBe('true:Home');
    expect(t.common.home.title.$key()).toBe('common.home.title');
    expect(t.common.home.$loading('title')).toBe(true);
  });

  test('lets extensions inspect current keys and caller-owned context', () => {
    const messages = {
      'common.home.empty': '',
      'common.home.title': 'Home',
    };
    const loadingKeys = new Set(['common.home.title']);
    const createT = tpath<
      TranslationCalls,
      {
        readonly loadingKeys: ReadonlySet<string>;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }
    >()
      .extend({
        $exists(ctx, key?: string) {
          return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
        },
      })
      .extend({
        $loading(ctx, key?: string) {
          return ctx.loadingKeys.has(appendKey(ctx.keys, key).join('.'));
        },
      })
      .define((ctx) => ctx.messages[ctx.keys.join('.')]);
    const t = createT({
      loadingKeys,
      messages,
    });

    expect(t.common.home.empty.$exists()).toBe(true);
    expect(t.common.home.missing.$exists()).toBe(false);
    expect(t.common.home.title.$loading()).toBe(true);
    expect(t.common.home.$loading('title')).toBe(true);
  });

  test('supports symbol-keyed extensions alongside matching string translation keys', () => {
    const exists = Symbol('exists');
    const messages = {
      'common.home.$exists': 'literal exists key',
      'common.home.title': 'Home',
    };
    const createT = tpath<
      TranslationCallsWithDollarKeys,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >()
      .extend({
        [exists](ctx, key?: string) {
          return ctx.messages[appendKey(ctx.keys, key).join('.')] !== undefined;
        },
      })
      .define((ctx, keys) => ctx.messages[keys.join('.')]);
    const t = createT({ messages });

    expect(t.common.home.$exists()).toBe('literal exists key');
    expect(t.common.home[exists]('$exists')).toBe(true);
    expect(t.common.home[exists]('missing')).toBe(false);
  });

  test('collects __call as a path key when the translation tree declares it', () => {
    const messages = {
      'common.home.__call': 'literal definition key',
      'common.home.title': 'Home',
    };
    const createT = tpath<
      TranslationCallsWithDefinitionKey,
      { readonly messages: Readonly<Record<string, string | undefined>> }
    >().define((ctx, keys) => ctx.messages[keys.join('.')]);
    const t = createT({ messages });

    expect(t.common.home.__call()).toBe('literal definition key');
    expect(t.common.home.title()).toBe('Home');
  });

  test('passes bound context into extension context', () => {
    const createT = tpath<
      TranslationCalls,
      {
        readonly debug: boolean;
        readonly locale: string;
      }
    >()
      .extend({
        $locale(ctx) {
          return ctx.locale;
        },
      })
      .extend({
        $debug(ctx) {
          return ctx.debug;
        },
      })
      .define(() => 'Home');
    const t = createT({
      debug: true,
      locale: 'en',
    });

    expect(t.common.home.title.$locale()).toBe('en');
    expect(t.common.home.title.$debug()).toBe(true);
  });

  test('returns undefined when the caller-owned formatter returns no translation', () => {
    const createT = tpath<TranslationCalls>().define(() => undefined);
    const t = createT();

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
    const createT = tpath<
      TranslationCalls,
      {
        readonly debug: boolean;
        readonly messages: Readonly<Record<string, string | undefined>>;
      }
    >().define((ctx) =>
      formatter({
        ctx,
        keys: ctx.keys,
      }),
    );
    const t = createT({ debug: true, messages: {} });

    expect(t.common.home.title()).toBe('common.home.title');
    expect(formatter).toHaveBeenCalledTimes(1);
  });

  test('lets formatter errors propagate to the caller', () => {
    const createT = tpath<TranslationCalls>().define(() => {
      throw new Error('formatter failed');
    });
    const t = createT();

    expect(() => t.common.home.greeting({ name: 'Ada' })).toThrow('formatter failed');
  });

  test('rejects symbol path keys', () => {
    const createT = tpath<TranslationCalls>().define(() => undefined);
    const t = createT();

    expect(() => {
      Reflect.get(t, Symbol('bad'));
    }).toThrow(TypeError);
  });
});
