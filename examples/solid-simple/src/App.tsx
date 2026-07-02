import { IntlMessageFormat } from "intl-messageformat";
import { For, Show, createSignal } from "solid-js";

import { tpath } from "../../../tpath.ts";
import { en } from "./translations/en";
import { ru } from "./translations/ru";
import type { Messages } from "./translations/types";

type Translations = typeof en;
type Accessor<T> = () => T;

interface TranslationContext {
  readonly debug: Accessor<boolean>;
  readonly locale: Accessor<string>;
  readonly messages: Accessor<Messages<Translations>>;
}

export const createT = tpath<Translations>()
  .ctx<TranslationContext>()
  .define({
    $exists(ctx, child?: string) {
      const nextKeys = child === undefined ? ctx.keys : [...ctx.keys, child];

      return resolveNested(ctx.messages(), nextKeys) !== undefined;
    },
    __call(ctx, keys, interpolation) {
      if (ctx.debug()) {
        return keys.join(".");
      }

      const message = resolveNested(ctx.messages(), keys);

      if (message === undefined) {
        return undefined;
      }

      return new IntlMessageFormat(message, ctx.locale(), undefined, { ignoreTag: true }).format(
        interpolation as any,
      ) as string;
    },
  });

const translations = {
  en,
  ru,
} as const;

type Locale = keyof typeof translations;

interface AppProps {
  readonly initialLocale?: Locale;
}

export function App(props: AppProps = {}) {
  const [locale, setLocale] = createSignal<Locale>(props.initialLocale ?? "en");
  const [debug, setDebug] = createSignal(false);
  const [notes, setNotes] = createSignal<readonly string[]>([]);
  const [text, setText] = createSignal("");
  const t = createT({
    debug,
    locale,
    messages: () => translations[locale()],
  });

  function toggleDebug() {
    setDebug((currentDebug) => !currentDebug);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const nextText = text().trim();

    if (nextText.length === 0) {
      return;
    }

    setNotes((currentNotes) => [...currentNotes, nextText]);
    setText("");
  }

  return (
    <main class="simple-app">
      <header>
        <h1>{t.app.title()}</h1>
        <div class="header-controls">
          <label>
            {t.app.localeSelect.label()}
            <select
              value={locale()}
              onChange={(event) => {
                setLocale(event.currentTarget.value as Locale);
              }}
            >
              <option value="en">{t.app.localeSelect.en()}</option>
              <option value="ru">{t.app.localeSelect.ru()}</option>
            </select>
          </label>
          <button type="button" onClick={toggleDebug}>
            {debug() ? t.app.debugToggle.hide() : t.app.debugToggle.show()}
          </button>
        </div>
      </header>

      <form onSubmit={submit}>
        <label for="note">{t.app.form.label()}</label>
        <input
          id="note"
          placeholder={t.app.form.placeholder.$exists() ? t.app.form.placeholder() : undefined}
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
        />
        <button type="submit">{t.app.form.submit()}</button>
      </form>

      <section aria-live="polite">
        <Show when={notes().length > 0} fallback={<p>{t.app.notes.empty()}</p>}>
          <p>{t.app.notes.count({ count: notes().length })}</p>
          <ul>
            <For each={notes()}>
              {(note, index) => <li>{t.app.notes.item({ index: index() + 1, text: note })}</li>}
            </For>
          </ul>
        </Show>
      </section>
    </main>
  );
}

function resolveNested(messages: Messages<Translations>, keys: readonly string[]) {
  let value: unknown = messages;

  for (const key of keys) {
    if (!isRecord(value)) {
      return undefined;
    }

    value = value[key];
  }

  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
