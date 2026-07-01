import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { RouterService } from "../shared/routerTypes";
import type { Locale } from "../shared/createT";
import { useT } from "../shared/useT";
import { createIssuesServices, type IssuesDeps } from "./issuesServices";

interface IssuesRouteProps {
  readonly locale: Locale;
  readonly shellDeps: IssuesDeps & {
    readonly router: RouterService;
    readonly loadTranslations: Parameters<typeof useT>[2];
  };
}

export default function IssuesRoute({ locale, shellDeps }: IssuesRouteProps) {
  const t = useT(locale, ["issues"], shellDeps.loadTranslations);
  const services = useMemo(() => createIssuesServices(shellDeps), [shellDeps]);
  const issues = useQuery({
    queryFn: ({ signal }) => services.loadIssues({ signal }),
    queryKey: ["issues", shellDeps.repositoryConfig.fullName],
  });
  const translationError = t.issues.title.$error();

  return (
    <section className="repo-lens__panel" data-testid="route-panel">
      <p className="repo-lens__section-title">{t.issues.title()}</p>
      {translationError === null ? null : <p role="alert">{translationError}</p>}
      {issues.isPending ? <p>{t.issues.loading()}</p> : null}
      {issues.error === null ? null : <p role="alert">{issues.error.message}</p>}
      {issues.data?.length === 0 ? <p>{t.issues.empty()}</p> : null}
      <ul className="repo-lens__list">
        {issues.data?.map((issue) => (
          <li key={issue.number}>
            <span className="repo-lens__status">{t.issues.status.$(issue.statusId)}</span>
            <a href={issue.htmlUrl}>
              #{issue.number} {issue.title}
            </a>
            <span>{t.issues.openedBy({ author: issue.authorLogin })}</span>
          </li>
        ))}
      </ul>
      <div className="repo-lens__actions">
        <button onClick={() => shellDeps.router.navigate({ id: "dashboard" })} type="button">
          {t.issues.actions.dashboard()}
        </button>
        <button onClick={() => shellDeps.router.navigate({ id: "commits" })} type="button">
          {t.issues.actions.commits()}
        </button>
      </div>
    </section>
  );
}
