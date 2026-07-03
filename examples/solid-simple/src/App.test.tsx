import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { App, createT } from "./App";
import { en } from "./translations/en";

describe("solid-simple example", () => {
  test("switches between nested translation dictionaries", async () => {
    const user = userEvent.setup();

    render(() => <App />);

    expect(screen.getByRole("heading", { name: "tpath Notes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Language"), "ru");

    expect(screen.getByRole("heading", { name: "Заметки tpath" })).toBeInTheDocument();
    expect(screen.getByLabelText("Заметка")).toBeInTheDocument();
    expect(screen.getByText("Пока нет заметок")).toBeInTheDocument();
  });

  test("renders translated UI and formats note interpolation", async () => {
    const user = userEvent.setup();

    render(() => <App initialLocale="en" />);

    expect(screen.getByRole("heading", { name: "tpath Notes" })).toBeInTheDocument();
    expect(screen.getByText("No notes yet")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Note"), "Keep translations boring");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("1. Keep translations boring")).toBeInTheDocument();
    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  test("toggles debug keys from the same translator proxy", async () => {
    const user = userEvent.setup();

    render(() => <App initialLocale="en" />);

    expect(screen.getByRole("heading", { name: "tpath Notes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show keys" }));

    expect(screen.getByRole("heading", { name: "app.title" })).toBeInTheDocument();
    expect(screen.getByLabelText("app.form.label")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "app.debugToggle.hide" }));

    expect(screen.getByRole("heading", { name: "tpath Notes" })).toBeInTheDocument();
  });

  test("renders another nested translation tree with the same inferred type", async () => {
    const user = userEvent.setup();

    render(() => <App initialLocale="ru" />);

    expect(screen.getByRole("heading", { name: "Заметки tpath" })).toBeInTheDocument();
    expect(screen.getByText("Пока нет заметок")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Заметка"), "Проверить вложенные переводы");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(screen.getByText("1. Проверить вложенные переводы")).toBeInTheDocument();
    expect(screen.getByText("1 заметка")).toBeInTheDocument();
  });

  test("can render keys from the same translator factory in debug mode", () => {
    const t = createT({ debug: () => true, messages: () => en });

    expect(t.app.title()).toBe("app.title");
    expect(t.app.notes.empty()).toBe("app.notes.empty");
  });

  test("resolves accessor state through the same translator proxy", () => {
    let debug = false;
    const t = createT({ debug: () => debug, messages: () => en });

    expect(t.app.title()).toBe("tpath Notes");

    debug = true;

    expect(t.app.title()).toBe("app.title");
  });
});
