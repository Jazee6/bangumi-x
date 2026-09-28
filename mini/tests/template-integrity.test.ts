import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// 开发者工具之外没有 WXML 编译器；这里做静态交叉检查，避免改名或移动文件后运行时才发现断链。
const root = resolve(import.meta.dir, "../miniprogram");
const files = [...new Bun.Glob("**/*.{wxml,json,wxss}").scanSync(root)]
  .filter((file) => !file.startsWith("miniprogram_npm/"))
  .map((file) => join(root, file));

const KEYWORDS = new Set(["true", "false", "null", "undefined", "typeof", "in", "of"]);

function resolveAsset(from: string, path: string): string {
  return path.startsWith("/") ? join(root, path) : resolve(dirname(from), path);
}

function expandIncludes(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return "";
  seen.add(file);
  return readFileSync(file, "utf8").replace(/<include\s+src="([^"]+)"\s*\/>/g, (_, src: string) =>
    expandIncludes(resolveAsset(file, src), seen),
  );
}

// 薄入口只调用共享的页面工厂，此时改读它相对导入的模块。
function scriptFor(file: string): string | null {
  const path = file.replace(/\.wxml$/, ".ts");
  if (!existsSync(path)) return null;
  const script = readFileSync(path, "utf8");
  if (/\b(?:Page|Component)\(/.test(script)) return script;
  return [...script.matchAll(/from "(\.[^"]+)"/g)]
    .map(([, source = ""]) => readFileSync(`${resolve(dirname(path), source)}.ts`, "utf8"))
    .join("\n");
}

function templateRoots(template: string): string[] {
  const roots = new Set<string>();
  for (const [, expression = ""] of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const code = expression.replace(/'[^']*'|"[^"]*"/g, "");
    for (const [, name = ""] of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)(?![\w$])/g))
      if (!KEYWORDS.has(name)) roots.add(name);
  }
  return [...roots];
}

function scopeNames(template: string): Set<string> {
  const names = new Set<string>();
  if (template.includes("wx:for=")) names.add("item").add("index");
  for (const [, name = ""] of template.matchAll(/wx:for-(?:item|index)="(\w+)"/g)) names.add(name);
  return names;
}

describe("Mini template integrity", () => {
  const templates = files.filter((file) => file.endsWith(".wxml") && scriptFor(file) !== null);

  test("event handlers exist on the owning page or component", () => {
    const missing: string[] = [];
    for (const file of templates) {
      const script = scriptFor(file)!;
      const template = expandIncludes(file);
      for (const [, handler = ""] of template.matchAll(
        /\s(?:capture-)?(?:bind|catch|mut-bind):?[\w-]+="([\w$]+)"/g,
      ))
        if (!new RegExp(`\\b${handler}\\s*(?:\\(|:)`).test(script))
          missing.push(`${relative(root, file)}: ${handler}`);
    }
    expect(missing).toEqual([]);
  });

  test("template bindings reference known data, properties or loop variables", () => {
    const missing: string[] = [];
    for (const file of templates) {
      const script = scriptFor(file)!;
      const template = expandIncludes(file);
      const scope = scopeNames(template);
      for (const name of templateRoots(template))
        if (!scope.has(name) && !new RegExp(`\\b${name}\\b`).test(script))
          missing.push(`${relative(root, file)}: ${name}`);
    }
    expect(missing).toEqual([]);
  });

  test("component, include and style paths resolve", () => {
    const missing: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (file.endsWith(".json")) {
        const usingComponents = (JSON.parse(content) as { usingComponents?: object })
          .usingComponents;
        for (const path of Object.values(usingComponents ?? {}) as string[])
          if (!existsSync(`${resolveAsset(file, path)}.ts`))
            missing.push(`${relative(root, file)}: ${path}`);
      } else {
        const pattern = file.endsWith(".wxss")
          ? /@import\s+"([^"]+)"/g
          : /<(?:include|import)\s+src="([^"]+)"/g;
        for (const [, path = ""] of content.matchAll(pattern))
          if (!existsSync(resolveAsset(file, path)))
            missing.push(`${relative(root, file)}: ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("icon names point at light and dark lucide assets", () => {
    const missing: string[] = [];
    for (const file of files.filter((path) => path.endsWith(".wxml"))) {
      const template = readFileSync(file, "utf8");
      for (const [tag, attributes = ""] of template.matchAll(/<[\w-]+(\s[^>]*?)\/?>/g)) {
        const muted = /\stone="muted"/.test(attributes);
        const value = attributes.match(/\s(?:name|icon)="([^"]*)"/)?.[1];
        if (!value || !/^<(ui-icon|ui-empty|action-button|ui-action-button)\b/.test(tag)) continue;
        const names = value.includes("{{")
          ? [...value.matchAll(/[?:]\s*'([\w-]+)'/g)].map(([, name = ""]) => name)
          : [value];
        for (const name of names)
          for (const suffix of muted ? [".muted", ".muted.dark"] : ["", ".dark"])
            if (!existsSync(join(root, `assets/icons/${name}${suffix}.svg`)))
              missing.push(`${relative(root, file)}: ${name}${suffix}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("every registered page has its four files", () => {
    const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")) as {
      pages: string[];
      subpackages?: Array<{ root: string; pages: string[] }>;
    };
    const pages = [
      ...app.pages,
      ...(app.subpackages ?? []).flatMap((pkg) => pkg.pages.map((page) => join(pkg.root, page))),
    ];
    const missing = pages.flatMap((page) =>
      ["ts", "wxml", "wxss", "json"]
        .filter((extension) => !existsSync(join(root, `${page}.${extension}`)))
        .map((extension) => `${page}.${extension}`),
    );
    expect(missing).toEqual([]);
  });
});
