import { en } from "./en";
import type { Messages } from "./types";

export const ru = {
  app: {
    form: {
      label: "Заметка",
      placeholder: "Напишите заметку",
      submit: "Добавить",
    },
    locale: "Русский",
    localeSelect: {
      label: "Язык",
      en: "English",
      ru: "Русский",
    },
    notes: {
      count: "{count, plural, one {# заметка} few {# заметки} many {# заметок} other {# заметки}}",
      empty: "Пока нет заметок",
      item: "{index, number}. {text}",
    },
    title: "Заметки TPath",
  },
} satisfies Messages<typeof en>;
