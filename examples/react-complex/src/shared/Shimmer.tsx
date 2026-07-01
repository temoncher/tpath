import type { ComponentPropsWithoutRef } from "react";

interface ShimmerProps extends ComponentPropsWithoutRef<"span"> {
  readonly loading?: boolean;
}

export function Shimmer({ children, className, loading = false, ...props }: ShimmerProps) {
  return (
    <span
      {...props}
      aria-busy={loading ? "true" : props["aria-busy"]}
      aria-hidden={loading ? "true" : props["aria-hidden"]}
      className={["repo-lens__text-shimmer", className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}
