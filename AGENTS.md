# Repository Guidance

## Testing

Write tests for behavior that should break if the public translation contract regresses. Prefer tests
that exercise path collection, caller-owned lookup behavior, interpolation, fallback behavior, and
type inference.

Avoid tests that only assert the current implementation shape. If a test would keep passing only
because it mirrors proxy internals rather than protecting meaningful behavior, delete it or fold the
assertion into a higher-value test.
