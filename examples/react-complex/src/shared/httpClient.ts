export interface HttpRequestOptions {
  readonly signal?: AbortSignal;
}

export interface HttpClient {
  get<T>(path: string, options?: HttpRequestOptions): Promise<T>;
}

interface HttpClientConfig {
  readonly apiBaseUrl: string;
}

export function createHttpClient({ apiBaseUrl }: HttpClientConfig): HttpClient {
  return {
    async get<T>(path: string, options?: HttpRequestOptions) {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`GitHub request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    },
  };
}
