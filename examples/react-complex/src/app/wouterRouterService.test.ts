import { describe, expect, test } from "vitest";

import { pathToRoute, routeToPath } from "./wouterRouterService";

describe("wouter router service", () => {
  test("maps between app routes and paths", () => {
    expect(pathToRoute("/")).toEqual({ id: "dashboard" });
    expect(pathToRoute("/commits")).toEqual({ id: "commits" });
    expect(pathToRoute("/issues")).toEqual({ id: "issues" });
    expect(routeToPath({ id: "dashboard" })).toBe("/");
    expect(routeToPath({ id: "commits" })).toBe("/commits");
    expect(routeToPath({ id: "issues" })).toBe("/issues");
  });
});
