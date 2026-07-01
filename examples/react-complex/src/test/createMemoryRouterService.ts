import type { AppRoute, RouterService } from "../shared/routerTypes";

export function createMemoryRouterService(initialRoute: AppRoute = { id: "dashboard" }) {
  let currentRoute = initialRoute;

  return {
    get currentRoute() {
      return currentRoute;
    },
    router: {
      navigate(route) {
        currentRoute = route;
      },
    } satisfies RouterService,
  };
}
