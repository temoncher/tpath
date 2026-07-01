import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { TranslationMessages } from "./createT";
import { useT, type LoadTranslations } from "./useT";

describe("useT", () => {
  test("shares translation loads for matching locale and namespace", async () => {
    const appMessages = {
      "app.title": "Repo Lens",
    } satisfies TranslationMessages;
    const loadTranslations = vi.fn<LoadTranslations>(() => Promise.resolve(appMessages));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => [useT("en", ["app"], loadTranslations), useT("en", ["app"], loadTranslations)],
      {
        wrapper: ({ children }: { readonly children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current[0].app.title()).toBe("Repo Lens");
    });

    expect(result.current[1].app.title()).toBe("Repo Lens");
    expect(loadTranslations).toHaveBeenCalledTimes(1);
  });

  test("keeps keys loading per requested translation namespace", async () => {
    const appLoad = deferred<TranslationMessages>();
    const dashboardLoad = deferred<TranslationMessages>();
    const loadTranslations: LoadTranslations = (_locale, namespace) => {
      if (namespace === "app") {
        return appLoad.promise;
      }

      if (namespace === "dashboard") {
        return dashboardLoad.promise;
      }

      throw new Error(`Unexpected namespace: ${namespace}`);
    };
    const appMessages = {
      "app.nav.dashboard": "Overview",
    } satisfies TranslationMessages;
    const dashboardMessages = {
      "dashboard.stats.stars": "Stars",
    } satisfies TranslationMessages;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useT("en", ["app", "dashboard"], loadTranslations), {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.app.nav.dashboard.$loading()).toBe(true);
    expect(result.current.dashboard.stats.stars.$loading()).toBe(true);

    await act(async () => {
      appLoad.resolve(appMessages);
      await appLoad.promise;
    });

    await waitFor(() => {
      expect(result.current.app.nav.dashboard.$loading()).toBe(false);
    });

    expect(result.current.dashboard.stats.stars.$loading()).toBe(true);

    await act(async () => {
      dashboardLoad.resolve(dashboardMessages);
      await dashboardLoad.promise;
    });

    await waitFor(() => {
      expect(result.current.dashboard.stats.stars.$loading()).toBe(false);
    });
  });

  test("keeps translation errors per requested namespace", async () => {
    const appLoad = deferred<TranslationMessages>();
    const demoLoad = deferred<TranslationMessages>();
    const loadTranslations: LoadTranslations = (_locale, namespace) => {
      if (namespace === "app") {
        return appLoad.promise;
      }

      if (namespace === "demo") {
        return demoLoad.promise;
      }

      throw new Error(`Unexpected namespace: ${namespace}`);
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useT("en", ["app", "demo"], loadTranslations), {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      appLoad.resolve({
        "app.title": "Repo Lens",
      });
      await appLoad.promise;
    });

    await waitFor(() => {
      expect(result.current.app.title.$error()).toBeNull();
      expect(result.current.demo.title.$error()).toBeNull();
    });

    await act(async () => {
      demoLoad.reject(new Error("Translation request failed: 500"));

      await expect(demoLoad.promise).rejects.toThrow("Translation request failed: 500");
    });

    await waitFor(() => {
      expect(result.current.app.title.$error()).toBeNull();
      expect(result.current.demo.title.$error()).toBe("Translation request failed: 500");
      expect(result.current.demo.title.$loading()).toBe(false);
    });
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}
