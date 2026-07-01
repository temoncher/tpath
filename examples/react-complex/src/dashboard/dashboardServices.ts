import type { RepositoryConfig, RepositorySummary } from "../shared/githubTypes";
import type { HttpClient } from "../shared/httpClient";

export interface DashboardDeps {
  readonly httpClient: HttpClient;
  readonly repositoryConfig: RepositoryConfig;
}

interface GithubRepositoryResponse {
  readonly description: string | null;
  readonly forks_count: number;
  readonly full_name: string;
  readonly html_url: string;
  readonly open_issues_count: number;
  readonly stargazers_count: number;
}

function createLoadRepository({ httpClient, repositoryConfig }: DashboardDeps) {
  return async (options?: { signal: AbortSignal }) => {
    const data = await httpClient.get<GithubRepositoryResponse>(
      `/repos/${repositoryConfig.owner}/${repositoryConfig.repo}`,
      {
        signal: options?.signal,
      },
    );

    return {
      description: data.description,
      forks: data.forks_count,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      openIssues: data.open_issues_count,
      stars: data.stargazers_count,
    } satisfies RepositorySummary;
  };
}

export function createDashboardServices(deps: DashboardDeps) {
  return {
    loadRepository: createLoadRepository(deps),
  };
}
