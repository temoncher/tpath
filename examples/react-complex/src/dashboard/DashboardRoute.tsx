import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { RouterService } from "../shared/routerTypes";
import type { Locale } from "../shared/createT";
import { useT } from "../shared/useT";
import { createDashboardServices, type DashboardDeps } from "./dashboardServices";

interface DashboardRouteProps {
  readonly locale: Locale;
  readonly shellDeps: DashboardDeps & {
    readonly router: RouterService;
    readonly loadTranslations: Parameters<typeof useT>[2];
  };
}

export default function DashboardRoute({ locale, shellDeps }: DashboardRouteProps) {
  const t = useT(locale, ["dashboard"], shellDeps.loadTranslations);
  const services = useMemo(() => createDashboardServices(shellDeps), [shellDeps]);
  const summary = useQuery({
    queryFn: ({ signal }) => services.loadRepository({ signal }),
    queryKey: ["dashboard", shellDeps.repositoryConfig.fullName],
  });
  const translationError = t.dashboard.title.$error();

  return (
    <section className="repo-lens__panel" data-testid="route-panel">
      <p className="repo-lens__section-title">{t.dashboard.title()}</p>
      {translationError === null ? null : <p role="alert">{translationError}</p>}
      {summary.isPending ? <p>{t.dashboard.loading()}</p> : null}
      {summary.error === null ? null : <p role="alert">{summary.error.message}</p>}
      {summary.data === undefined ? null : (
        <>
          <h2>{summary.data.fullName}</h2>
          <p>{summary.data.description ?? t.dashboard.noDescription()}</p>
          <dl className="repo-lens__stats">
            <div>
              <dt>{t.dashboard.stats.stars()}</dt>
              <dd>{summary.data.stars}</dd>
            </div>
            <div>
              <dt>{t.dashboard.stats.forks()}</dt>
              <dd>{summary.data.forks}</dd>
            </div>
            <div>
              <dt>{t.dashboard.stats.openIssues()}</dt>
              <dd>{summary.data.openIssues}</dd>
            </div>
          </dl>
          <div className="repo-lens__actions">
            <button onClick={() => shellDeps.router.navigate({ id: "commits" })} type="button">
              {t.dashboard.actions.commits()}
            </button>
            <button onClick={() => shellDeps.router.navigate({ id: "issues" })} type="button">
              {t.dashboard.actions.issues()}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
