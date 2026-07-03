import { useState } from "react";
import type { FormEvent } from "react";

import { tpath } from "../../../tpath.ts";
import { en } from "./translations/en";
import { formatMessage } from "./translations/formatMessage";
import { ru } from "./translations/ru";
import type { Messages, TranslationPath } from "./translations/types";

type Translations = typeof en;

interface TranslationContext {
  readonly debug: boolean;
  readonly messages: Messages<Translations>;
}

export const createT = tpath<TranslationPath<Translations>, TranslationContext>().define(
  (ctx, keys, interpolation) => {
    if (ctx.debug) {
      return keys.join(".");
    }

    const message = resolveNested(ctx.messages, keys);

    if (message === undefined) {
      return undefined;
    }

    return formatMessage(message, interpolation);
  },
);

const translations = {
  en,
  ru,
} as const;

type Locale = keyof typeof translations;

interface AppProps {
  readonly initialLocale?: Locale;
}

export function App({ initialLocale = "en" }: AppProps = {}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [debug, setDebug] = useState(false);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const [text, setText] = useState("");
  const t = createT({
    debug,
    messages: translations[locale],
  });

  function toggleDebug() {
    setDebug((currentDebug) => !currentDebug);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextText = text.trim();

    if (nextText.length === 0) {
      return;
    }

    setNotes((currentNotes) => [...currentNotes, nextText]);
    setText("");
  }

  return (
    <main className="simple-app">
      <header>
        <h1>{t.app.title()}</h1>
        <div className="header-controls">
          <label>
            {t.app.localeSelect.label()}
            <select
              value={locale}
              onChange={(event) => {
                setLocale(event.currentTarget.value as Locale);
              }}
            >
              <option value="en">{t.app.localeSelect.en()}</option>
              <option value="ru">{t.app.localeSelect.ru()}</option>
            </select>
          </label>
          <button type="button" onClick={toggleDebug}>
            {debug ? t.app.debugToggle.hide() : t.app.debugToggle.show()}
          </button>
        </div>
      </header>

      <form onSubmit={submit}>
        <label htmlFor="note">{t.app.form.label()}</label>
        <input
          id="note"
          placeholder={t.app.form.placeholder()}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <button type="submit">{t.app.form.submit()}</button>
      </form>

      <section aria-live="polite">
        {notes.length === 0 ? (
          <p>{t.app.notes.empty()}</p>
        ) : (
          <>
            <p>{t.app.notes.count({ count: notes.length })}</p>
            <ul>
              {notes.map((note, index) => (
                <li key={`${note}:${index}`}>
                  {t.app.notes.item({ index: index + 1, text: note })}
                </li>
              ))}
            </ul>
          </>
        )}
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
