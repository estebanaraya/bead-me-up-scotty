// Lets `node --test` import the app's TypeScript modules, whose relative
// imports omit the extension (Next's bundler resolves them; Node does not).
// Node 24 strips the types itself; this hook only adds ".ts" / ".tsx".
// Usage: node --no-warnings --import ./scripts/ts-resolve.mjs --test "lib/**/*.test.ts"
import { register } from "node:module";

const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && context.parentURL && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const ext of [".ts", ".tsx"]) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}`;

register("data:text/javascript," + encodeURIComponent(hook));
