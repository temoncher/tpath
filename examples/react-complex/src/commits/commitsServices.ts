import type { CommitSummary, RepositoryConfig } from "../shared/githubTypes";
import type { HttpClient } from "../shared/httpClient";

export interface CommitsDeps {
  readonly httpClient: HttpClient;
  readonly repositoryConfig: RepositoryConfig;
}

interface GithubCommitResponse {
  readonly commit: {
    readonly author: {
      readonly name: string;
    } | null;
    readonly message: string;
  };
  readonly html_url: string;
  readonly sha: string;
}

function createLoadCommits({ httpClient, repositoryConfig }: CommitsDeps) {
  return async (options?: { signal: AbortSignal }) => {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const data = await httpClient.get<readonly GithubCommitResponse[]>(
      `/repos/${repositoryConfig.owner}/${repositoryConfig.repo}/commits?per_page=5`,
      {
        signal: options?.signal,
      },
    );

    return data.map(
      (commit): CommitSummary => ({
        authorName: commit.commit.author?.name ?? "Unknown author",
        htmlUrl: commit.html_url,
        message: commit.commit.message.split("\n")[0] ?? commit.commit.message,
        sha: commit.sha.slice(0, 7),
      }),
    );
  };
}

export function createCommitsServices(deps: CommitsDeps) {
  return {
    loadCommits: createLoadCommits(deps),
  };
}
