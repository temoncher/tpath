import type { IssueSummary, RepositoryConfig } from "../shared/githubTypes";
import type { HttpClient } from "../shared/httpClient";

export interface IssuesDeps {
  readonly httpClient: HttpClient;
  readonly repositoryConfig: RepositoryConfig;
}

interface GithubIssueResponse {
  readonly html_url: string;
  readonly number: number;
  readonly pull_request?: unknown;
  readonly status_id?: string;
  readonly title: string;
  readonly user: {
    readonly login: string;
  } | null;
}

function createLoadIssues({ httpClient, repositoryConfig }: IssuesDeps) {
  return async (options?: { signal: AbortSignal }) => {
    const data = await httpClient.get<readonly GithubIssueResponse[]>(
      `/repos/${repositoryConfig.owner}/${repositoryConfig.repo}/issues?state=open&per_page=5`,
      {
        signal: options?.signal,
      },
    );

    return data
      .filter((issue) => issue.pull_request === undefined)
      .map(
        (issue): IssueSummary => ({
          authorLogin: issue.user?.login ?? "unknown",
          htmlUrl: issue.html_url,
          number: issue.number,
          statusId: issue.status_id ?? "open",
          title: issue.title,
        }),
      );
  };
}

export function createIssuesServices(deps: IssuesDeps) {
  return {
    loadIssues: createLoadIssues(deps),
  };
}
