import type { RepositoryConfig } from "../shared/githubTypes";
import type { HttpClient } from "../shared/httpClient";
import type { RouterService } from "../shared/routerTypes";
import type { LoadTranslations } from "../shared/useT";

export interface AppConfig {
  readonly owner: string;
  readonly repo: string;
}

export interface ShellDepsConfig {
  readonly appConfig: AppConfig;
  readonly baseHttpClient?: (values: ShellDepsValues) => HttpClient;
  readonly loadTranslations?: LoadTranslations;
  readonly router: RouterService;
}

export interface ShellDepsValues {
  readonly appConfig: AppConfig;
  readonly router: RouterService;
}

export interface ShellDeps extends ShellDepsValues {
  readonly httpClient: HttpClient;
  readonly loadTranslations: LoadTranslations;
  readonly repositoryConfig: RepositoryConfig;
}
