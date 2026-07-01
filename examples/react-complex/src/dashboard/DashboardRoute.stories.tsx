import { QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

import "../app/App.css";
import { createAppQueryClient } from "../app/queryClient";
import {
  createEmptyHttpClient,
  createErrorHttpClient,
  createFakeHttpClient,
  createLoadingHttpClient,
} from "../test/fakeHttpClient";
import { createStoryShellDeps } from "../test/createStoryShellDeps";
import DashboardRoute from "./DashboardRoute";

const meta = {
  component: DashboardRoute,
  decorators: [
    (Story) => (
      <QueryClientProvider client={createAppQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  title: "Repo Lens/DashboardRoute",
} satisfies Meta<typeof DashboardRoute>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    locale: "en",
    shellDeps: createStoryShellDeps({ httpClient: createFakeHttpClient() }),
  },
};

export const Loading: Story = {
  args: {
    locale: "en",
    shellDeps: createStoryShellDeps({ httpClient: createLoadingHttpClient() }),
  },
};

export const Error: Story = {
  args: {
    locale: "en",
    shellDeps: createStoryShellDeps({ httpClient: createErrorHttpClient("Dashboard failed") }),
  },
};

export const Empty: Story = {
  args: {
    locale: "en",
    shellDeps: createStoryShellDeps({ httpClient: createEmptyHttpClient() }),
  },
};
