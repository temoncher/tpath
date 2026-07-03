import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          tpath: new URL("../../../tpath.ts", import.meta.url).pathname,
        },
      },
    });
  },
};

export default config;
