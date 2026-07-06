// Test-only shim for the `server-only` package: in production this module
// intentionally throws when imported from client code, but in Vitest we just
// want it to be a no-op so adapter modules can be loaded by unit tests.
export {};
