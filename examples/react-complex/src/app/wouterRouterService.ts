import { useMemo } from "react";
import { useLocation } from "wouter";

import type { AppRoute, RouterService } from "../shared/routerTypes";

export function pathToRoute(path: string): AppRoute {
  if (path === "/commits") {
    return { id: "commits" };
  }

  if (path === "/issues") {
    return { id: "issues" };
  }

  return { id: "dashboard" };
}

export function routeToPath(route: AppRoute) {
  return route.id === "dashboard" ? "/" : `/${route.id}`;
}

export function useWouterRouterService(): RouterService {
  const [, navigate] = useLocation();

  return useMemo(
    () => ({
      navigate(route) {
        navigate(routeToPath(route));
      },
    }),
    [navigate],
  );
}
