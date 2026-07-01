import type { RepositoryConfig } from "../shared/githubTypes";
import { createHttpClient, type HttpClient } from "../shared/httpClient";
import type {
  FlatMessages,
  Locale,
  TranslationMessages,
  TranslationNamespace,
} from "../shared/createT";
import type { ShellDeps, ShellDepsConfig, ShellDepsValues } from "./shellTypes";

const GITHUB_API_BASE_URL = "https://api.github.com";
const DEMO_TRANSLATION_DELAY_MS = 1200;

export function createShellDeps(config: ShellDepsConfig): ShellDeps {
  const values = {
    appConfig: config.appConfig,
    router: config.router,
  };
  const repositoryConfig = createRepositoryConfig(values);
  const baseHttpClient = (config.baseHttpClient ?? createBaseHttpClient)(values);

  return {
    ...values,
    httpClient: baseHttpClient,
    loadTranslations: config.loadTranslations ?? loadDemoTranslations,
    repositoryConfig,
  };
}

async function loadDemoTranslations(
  locale: Locale,
  namespace: TranslationNamespace,
): Promise<TranslationMessages> {
  if (namespace === "demo") {
    await delay(DEMO_TRANSLATION_DELAY_MS);
  }

  return loadNamespaceMessages(locale, namespace);
}

export async function loadNamespaceMessages(
  locale: Locale,
  namespace: TranslationNamespace,
  fetcher: typeof fetch = fetch,
): Promise<TranslationMessages> {
  const response = await fetcher(`/translations/${locale}/${namespace}.json`);

  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`);
  }

  return (await response.json()) as FlatMessages;
}

function createRepositoryConfig({ appConfig }: ShellDepsValues): RepositoryConfig {
  return {
    fullName: `${appConfig.owner}/${appConfig.repo}`,
    owner: appConfig.owner,
    repo: appConfig.repo,
  };
}

function createBaseHttpClient(): HttpClient {
  return createHttpClient({ apiBaseUrl: GITHUB_API_BASE_URL });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
