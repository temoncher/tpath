import type { HttpClient } from "../shared/httpClient";

const repository = {
  description: "A tiny copy-file proxy path helper for TypeScript.",
  forks_count: 8,
  full_name: "temoncher/tpath",
  html_url: "https://github.com/temoncher/tpath",
  open_issues_count: 3,
  stargazers_count: 64,
};

const commits = [
  {
    commit: {
      author: {
        name: "Mira",
      },
      message: "Add generated translation example\n\nBody",
    },
    html_url: "https://github.com/temoncher/tpath/commit/abc1234",
    sha: "abc1234abcd",
  },
  {
    commit: {
      author: {
        name: "Niko",
      },
      message: "Split GitHub routes by feature",
    },
    html_url: "https://github.com/temoncher/tpath/commit/def5678",
    sha: "def5678abcd",
  },
];

const issues = [
  {
    html_url: "https://github.com/temoncher/tpath/issues/42",
    number: 42,
    status_id: "needs-triage",
    title: "Document generated translation workflow",
    user: {
      login: "temoncher",
    },
  },
];

function pending<T>(): Promise<T> {
  return Promise.race([]) as Promise<T>;
}

export function createFakeHttpClient(): HttpClient {
  return {
    get<T>(path: string) {
      if (path.endsWith("/commits?per_page=5")) {
        return Promise.resolve(commits as T);
      }

      if (path.endsWith("/issues?state=open&per_page=5")) {
        return Promise.resolve(issues as T);
      }

      return Promise.resolve(repository as T);
    },
  };
}

export function createEmptyHttpClient(): HttpClient {
  return {
    get<T>(path: string) {
      if (path.endsWith("/commits?per_page=5") || path.endsWith("/issues?state=open&per_page=5")) {
        return Promise.resolve([] as T);
      }

      return Promise.resolve({
        ...repository,
        forks_count: 0,
        open_issues_count: 0,
        stargazers_count: 0,
      } as T);
    },
  };
}

export function createErrorHttpClient(message: string): HttpClient {
  const error = new Error(message);

  return {
    get: () => Promise.reject(error),
  };
}

export function createLoadingHttpClient(): HttpClient {
  return {
    get: () => pending(),
  };
}
