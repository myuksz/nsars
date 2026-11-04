import { readFile } from "node:fs/promises";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    const source = `export const env = new Proxy(Object.create(null), {
      get(_target, property) {
        return globalThis.__NSARS_TEST_ENV?.[property];
      },
      has(_target, property) {
        return property in (globalThis.__NSARS_TEST_ENV ?? Object.create(null));
      }
    });`;
    return {
      url: `data:text/javascript,${encodeURIComponent(source)}`,
      shortCircuit: true,
    };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      specifier.startsWith(".") &&
      !/\.[a-z0-9]+$/i.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && /\.tsx?$/.test(new URL(url).pathname)) {
    const source = await readFile(new URL(url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: new URL(url).pathname,
    }).outputText;
    return { format: "module", source: output, shortCircuit: true };
  }
  return nextLoad(url, context);
}
