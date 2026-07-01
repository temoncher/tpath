import { Suspense, lazy, useMemo, useState } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { useLocation } from "wouter";

import type { AppRoute } from "../shared/routerTypes";
import type { Locale } from "../shared/createT";
import { Shimmer } from "../shared/Shimmer";
import { useT } from "../shared/useT";
import { createShellDeps } from "./shellDeps";
import type { ShellDeps } from "./shellTypes";
import { pathToRoute, useWouterRouterService } from "./wouterRouterService";

const navRoutes = [
  { id: "dashboard" },
  { id: "commits" },
  { id: "issues" },
] satisfies readonly AppRoute[];

const routes = {
  dashboard: lazy(() => import("../dashboard/DashboardRoute")),
  commits: lazy(() => import("../commits/CommitsRoute")),
  issues: lazy(() => import("../issues/IssuesRoute")),
} satisfies Record<
  AppRoute["id"],
  LazyExoticComponent<
    ComponentType<{
      readonly locale: Locale;
      readonly shellDeps: ShellDeps;
    }>
  >
>;

type CreateShellDeps = typeof createShellDeps;

interface AppShellProps {
  readonly createDeps?: CreateShellDeps;
  readonly initialLocale?: Locale;
}

export function AppShell({ createDeps = createShellDeps, initialLocale = "en" }: AppShellProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const router = useWouterRouterService();
  const shellDeps = useMemo(
    () =>
      createDeps({
        appConfig: {
          owner: "temoncher",
          repo: "tpath",
        },
        router,
      }),
    [createDeps, router],
  );
  const t = useT(locale, ["app", "demo"], shellDeps.loadTranslations);
  const [location] = useLocation();
  const route = pathToRoute(location);
  const RouteComponent = routes[route.id];
  const appError = t.app.title.$error();
  const demoError = t.demo.title.$error();

  return (
    <main className="repo-lens" data-testid="repo-lens">
      <header className="repo-lens__header">
        <div>
          <p className="repo-lens__eyebrow">{t.app.eyebrow()}</p>
          <h1>{shellDeps.repositoryConfig.fullName}</h1>
          <p className="repo-lens__tagline">
            <Shimmer loading={t.app.title.$loading()}>{t.app.tagline()}</Shimmer>
          </p>
        </div>
        <div className="repo-lens__header-controls">
          <label className="repo-lens__locale">
            {t.app.locale.label()}
            <select
              value={locale}
              onChange={(event) => {
                setLocale(event.currentTarget.value as Locale);
              }}
            >
              <option value="en">{t.app.locale.en()}</option>
              <option value="ru">{t.app.locale.ru()}</option>
            </select>
          </label>
          <nav className="repo-lens__nav" aria-label="Repo sections">
            {navRoutes.map((item) => (
              <button
                aria-pressed={route.id === item.id}
                key={item.id}
                onClick={() => shellDeps.router.navigate(item)}
                type="button"
              >
                <Shimmer loading={t.app.nav.$loading(item.id)}>{t.app.nav.$(item.id)}</Shimmer>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {appError === null ? null : <p role="alert">{appError}</p>}
      {demoError === null ? null : <p role="alert">{demoError}</p>}
      <section
        className="repo-lens__translation-demo"
        aria-label={t.demo.title.$loading() ? undefined : t.demo.title()}
      >
        <p className="repo-lens__section-title">
          <Shimmer loading={t.demo.title.$loading()}>{t.demo.title()}</Shimmer>
        </p>
        <dl>
          <div>
            <dt>
              <Shimmer loading={t.demo.fastValue.$loading()}>{t.demo.fastValue()}</Shimmer>
            </dt>
            <dd>
              <Shimmer loading={t.app.nav.dashboard.$loading()}>{t.app.nav.dashboard()}</Shimmer>
            </dd>
          </div>
          <div>
            <dt>
              <Shimmer loading={t.demo.slowValue.$loading()}>{t.demo.slowValue()}</Shimmer>
            </dt>
            <dd>
              <Shimmer loading={t.demo.pendingValue.$loading()}>{t.demo.pendingValue()}</Shimmer>
            </dd>
          </div>
        </dl>
      </section>
      <Suspense fallback={<p className="repo-lens__loading">{t.app.routeLoading()}</p>}>
        <RouteComponent locale={locale} shellDeps={shellDeps} />
      </Suspense>
    </main>
  );
}
