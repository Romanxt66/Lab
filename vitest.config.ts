import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Adapter modules import "server-only" for the Next.js boundary. In
      // Vitest we shim it to a no-op so unit tests can load them.
      "server-only": fileURLToPath(
        new URL("./src/shared/__test__/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
