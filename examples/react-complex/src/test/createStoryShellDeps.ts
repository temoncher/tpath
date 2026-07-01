import type { ShellDeps } from "../app/shellTypes";
import appEn from "../__translationMocks__/app.gen";
import commitsEn from "../__translationMocks__/commits.gen";
import dashboardEn from "../__translationMocks__/dashboard.gen";
import demoEn from "../__translationMocks__/demo.gen";
import issuesEn from "../__translationMocks__/issues.gen";
import type { RepositoryConfig } from "../shared/githubTypes";
import type { HttpClient } from "../shared/httpClient";
import type { TranslationMessages, TranslationNamespace } from "../shared/createT";
import { createMemoryRouterService } from "./createMemoryRouterService";
import { createFakeHttpClient } from "./fakeHttpClient";
import { flattenMessages } from "./flattenMessages";

export function createStoryShellDeps({
  httpClient = createFakeHttpClient(),
}: {
  readonly httpClient?: HttpClient;
} = {}): ShellDeps {
  const memoryRouter = createMemoryRouterService();
  const appConfig = {
    owner: "temoncher",
    repo: "tpath",
  };
  const repositoryConfig: RepositoryConfig = {
    fullName: `${appConfig.owner}/${appConfig.repo}`,
    owner: appConfig.owner,
    repo: appConfig.repo,
  };
  const baseValues = {
    appConfig,
    router: memoryRouter.router,
  };

  return {
    ...baseValues,
    httpClient,
    loadTranslations: (_locale, namespace) => Promise.resolve(translations[namespace]),
    repositoryConfig,
  };
}

const translations = {
  app: flattenMessages(appEn),
  commits: flattenMessages(commitsEn),
  dashboard: flattenMessages(dashboardEn),
  demo: flattenMessages(demoEn),
  issues: flattenMessages(issuesEn),
} satisfies Record<TranslationNamespace, TranslationMessages>;
