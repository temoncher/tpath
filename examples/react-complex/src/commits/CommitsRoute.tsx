import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { RouterService } from "../shared/routerTypes";
import type { Locale } from "../shared/createT";
import { useT } from "../shared/useT";
import { createCommitsServices, type CommitsDeps } from "./commitsServices";

interface CommitsRouteProps {
  readonly locale: Locale;
  readonly shellDeps: CommitsDeps & {
    readonly router: RouterService;
    readonly loadTranslations: Parameters<typeof useT>[2];
  };
}

export default function CommitsRoute({ locale, shellDeps }: CommitsRouteProps) {
  const t = useT(locale, ["commits"], shellDeps.loadTranslations);
  const services = useMemo(() => createCommitsServices(shellDeps), [shellDeps]);
  const commits = useQuery({
    queryFn: ({ signal }) => services.loadCommits({ signal }),
    queryKey: ["commits", shellDeps.repositoryConfig.fullName],
  });
  const translationError = t.commits.title.$error();

  return (
    <section className="repo-lens__panel" data-testid="route-panel">
      <p className="repo-lens__section-title">{t.commits.title()}</p>
      {translationError === null ? null : <p role="alert">{translationError}</p>}
      {commits.isPending ? <p>{t.commits.loading()}</p> : null}
      {commits.error === null ? null : <p role="alert">{commits.error.message}</p>}
      {commits.data?.length === 0 ? <p>{t.commits.empty()}</p> : null}
      <ul className="repo-lens__list">
        {commits.data?.map((commit) => (
          <li key={commit.sha}>
            <a href={commit.htmlUrl}>{commit.message}</a>
            <span>{t.commits.byAuthor({ author: commit.authorName, sha: commit.sha })}</span>
          </li>
        ))}
      </ul>
      <div className="repo-lens__actions">
        <button onClick={() => shellDeps.router.navigate({ id: "dashboard" })} type="button">
          {t.commits.actions.dashboard()}
        </button>
        <button onClick={() => shellDeps.router.navigate({ id: "issues" })} type="button">
          {t.commits.actions.issues()}
        </button>
      </div>
    </section>
  );
}
