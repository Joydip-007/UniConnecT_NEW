// Non-storybook `package` adapter. Bundles dist/ when present (the authoritative
// component list comes from shipped .d.ts; with no dist it synthesizes an
// entry from src/ as a last resort) and opportunistically enriches each
// component from src/ — JSDoc and dir-derived group. Every enrichment miss
// degrades to the plain-dist behaviour.
//
// Discovery is heuristic-based; each heuristic has a `.design-sync/config.json`
// override (ASSUMPTION comments below name them) so repos that don't match the
// defaults write config, not code. `componentSrcMap` is the single override
// knob for component inclusion: non-null value = add/pin src path, null =
// exclude a .d.ts-exported internal.

// forked from design-sync lib/source-kit.mjs — cfg.srcInclude allowlist so a
// broadened srcDir ("src") doesn't sweep main.tsx/pages/hooks/stores into the
// synth-entry `export *` bundle (main.tsx's top-level await hard-fails esbuild)
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { Project, Node, ts } from 'ts-morph';
import { leadingJsdoc, readText, slash, walk } from '../../.ds-sync/lib/common.mjs';
import { resolveDistEntry } from '../../.ds-sync/lib/bundle.mjs';
import { exportedNames, isComponentName } from '../../.ds-sync/lib/dts.mjs';

const NON_IMPL_RX = /\.(stories|test|spec)\./;
const SRC_IMPL_RX = /\.(tsx|jsx)$/;
// Dir names that don't usefully group components — skip so the emitted path
// is `components/<group>/<Name>` not `components/components/<Name>`.
const GENERIC_DIR = new Set(['components', 'component', 'src', 'lib', 'ui', 'packages', 'react']);
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';

// No .d.ts → scan src files for PascalCase value exports via ts-morph.
function deriveComponentsFromSrc(srcFiles) {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true, skipLibCheck: true },
  });
  const seen = new Set();
  for (const p of srcFiles) {
    if (NON_IMPL_RX.test(p) || !SRC_IMPL_RX.test(p)) continue;
    const sf = project.addSourceFileAtPathIfExists(p);
    if (!sf) continue;
    for (const [name, decls] of sf.getExportedDeclarations()) {
      // `export default function Button()` is keyed as 'default' — recover
      // the declared name from the function/class node.
      const real = name === 'default'
        ? decls.map((d) => d.getName?.()).find((n) => n && n !== 'default')
        : name;
      if (!real || !/^[A-Z][A-Za-z0-9]*$/.test(real)) continue;
      if (decls.some((d) => Node.isVariableDeclaration(d) || Node.isFunctionDeclaration(d) || Node.isClassDeclaration(d))) {
        seen.add(real);
      }
    }
  }
  return [...seen].sort().map((name) => ({ name, group: 'general' }));
}

export async function resolvePackage(ctx) {
  const { PKG_DIR, pkgJson, ENTRY_OVERRIDE, PKG, OUT, cfg } = ctx;
  const srcMap = cfg.componentSrcMap ?? {};

  // ── 1. src/ discovery (best-effort; feeds enrichment + synth-entry fallback).
  // ASSUMPTION: source root is first of src/ | lib/ | components/. Override: cfg.srcDir.
  const srcRoot = [cfg.srcDir, 'src', 'lib', 'components']
    .map((d) => d && resolve(PKG_DIR, d))
    .find((d) => d && existsSync(d));
  let srcFiles = srcRoot ? walk(srcRoot, (n) => /\.(tsx|jsx|mdx?)$/.test(n)) : [];
  // ASSUMPTION: when cfg.srcInclude is set, only files whose path (relative to
  // srcRoot) starts with one of the listed prefixes are real components —
  // everything else (pages, main.tsx, hooks, stores, router) is dropped from
  // BOTH the synth-entry `export *` list and the discovery scan. Override:
  // cfg.srcInclude (array of srcRoot-relative path prefixes).
  if (srcRoot && Array.isArray(cfg.srcInclude) && cfg.srcInclude.length) {
    const prefixes = cfg.srcInclude.map((p) => slash(resolve(srcRoot, p)));
    srcFiles = srcFiles.filter((p) => prefixes.some((pre) => p === pre || p.startsWith(pre + '/')));
  }
  // ASSUMPTION: cfg.srcExclude drops specific files (srcRoot-relative paths)
  // from BOTH the synth-entry list and discovery — for two files that export
  // the same component NAME from different feature dirs (a real `export *`
  // collision componentSrcMap:null can't fix, since that only prunes the
  // discovery list, not the entry file list that's actually bundled).
  if (srcRoot && Array.isArray(cfg.srcExclude) && cfg.srcExclude.length) {
    const excluded = new Set(cfg.srcExclude.map((p) => slash(resolve(srcRoot, p))));
    srcFiles = srcFiles.filter((p) => !excluded.has(p));
  }

  // ── 2. entry: dist if it exists, else synthesize from src/ (last resort).
  let entry = resolveDistEntry({ pkgDir: PKG_DIR, pkgJson, override: ENTRY_OVERRIDE, pkgName: PKG, soft: true });
  let synthEntry = false;
  if (!entry) {
    if (!srcRoot) {
      console.error(`[NO_DIST] ${PKG} has no built entry and no src/ to synthesize from — run its build.`);
      process.exit(1);
    }
    const comps = srcFiles.filter((p) => SRC_IMPL_RX.test(p) && !NON_IMPL_RX.test(p));
    entry = join(OUT, '.pkg-entry.mjs');
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true, skipLibCheck: true },
    });
    // ASSUMPTION: cfg.srcExcludeExports = {"srcRoot-relative/path.tsx": ["Name", ...]}
    // — drops specific NAMED exports from a multi-export file's re-export
    // (e.g. two feature dirs each define a same-named component inside an
    // otherwise-unrelated shared file; srcExclude would wrongly drop the
    // file's other legitimate exports too). Only affects synth-entry codegen.
    const excludeExportsFor = new Map(
      Object.entries(cfg.srcExcludeExports ?? {}).map(([p, names]) => [slash(resolve(srcRoot, p)), new Set(names)]),
    );
    const lines = comps.flatMap((p) => {
      const sf = project.addSourceFileAtPathIfExists(p);
      const excludeNames = excludeExportsFor.get(p);
      const out = [];
      // `export * from` never re-exports a module's DEFAULT export (ES
      // module semantics) — feature components commonly use `export default
      // function Name() {}`, so without this they parse as component names
      // (deriveComponentsFromSrc recovers the name from the declaration) but
      // never land on window.<globalName> ([BUNDLE_EXPORT] "not a component").
      const defaultDecls = sf?.getExportedDeclarations().get('default');
      const defName = defaultDecls
        ?.map((d) => d.getName?.()).find((n) => n && n !== 'default' && /^[A-Z][A-Za-z0-9]*$/.test(n));
      if (excludeNames) {
        const keep = sf ? [...sf.getExportedDeclarations().keys()].filter((n) => n !== 'default' && !excludeNames.has(n)) : [];
        if (keep.length) out.push(`export { ${keep.join(', ')} } from ${JSON.stringify(p)};`);
      } else {
        out.push(`export * from ${JSON.stringify(p)};`);
      }
      if (defName && !excludeNames?.has(defName)) out.push(`export { default as ${defName} } from ${JSON.stringify(p)};`);
      return out;
    });
    writeFileSync(entry, lines.join('\n') + '\n');
    synthEntry = true;
    console.error(
      `[NO_DIST] no built entry — synthesizing from ${comps.length} src files (run the package's build for best results)`,
    );
  }

  // ── 3. component list: from shipped .d.ts (authoritative when dist exists).
  // ASSUMPTION: components = PascalCase value exports in the .d.ts tree.
  // Override: cfg.componentSrcMap (non-null adds/pins, null excludes).
  const exported = exportedNames(PKG_DIR, pkgJson);
  const names = new Set([...exported].filter(isComponentName));
  for (const [k, v] of Object.entries(srcMap)) {
    if (v === null) { names.delete(k); continue; }
    // Names reach `<script>` blocks in the emitted HTML — reject anything
    // that isn't a plain PascalCase identifier.
    if (!/^[A-Z][A-Za-z0-9]*$/.test(k)) {
      console.error(`[CONFIG] componentSrcMap: "${k}" is not a valid component name (PascalCase identifiers only)`);
      continue;
    }
    names.add(k);
  }
  let components = [...names].sort().map((name) => ({ name, group: 'general' }));
  if (!components.length && synthEntry) {
    components = deriveComponentsFromSrc(srcFiles).filter((c) => srcMap[c.name] !== null);
  }
  if (!components.length) {
    if (cfg.cssEntry || existsSync(join(PKG_DIR, 'styles.css'))) {
      console.error('[ZERO_MATCH] no component exports — treating as tokens-only DS');
      return { shape: 'package', entry, components: [], tokensOnly: true };
    }
    console.error(`[ZERO_MATCH] no PascalCase exports in ${PKG} and no styles — nothing to sync`);
    process.exit(1);
  }

  // ── 4. src/ enrichment per component. Every miss degrades to plain-dist.
  if (srcRoot) {
    for (const c of components) {
      // Pinned via config → skip fuzzy-find entirely.
      let hit = typeof srcMap[c.name] === 'string' ? slash(resolve(PKG_DIR, srcMap[c.name])) : null;
      if (!hit) {
        // ASSUMPTION: <Name>.tsx | <name>/<name>.tsx | <Name>/index.tsx |
        // <kebab-name>.tsx, case-insensitive; dir-match ranks above
        // bare-file match, then prefer one that actually exports `c.name`.
        // Override: cfg.componentSrcMap.
        const kebab = c.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
        const nameRx = new RegExp(
          `(?:^|/)(?:${c.name}/(?:index|${c.name})\\.(tsx|jsx)|(?:${c.name}|${kebab})\\.(tsx|jsx))$`,
          'i',
        );
        const hits = srcFiles
          .filter((p) => nameRx.test(p) && !NON_IMPL_RX.test(p))
          .sort(
            (a, b) =>
              (b.toLowerCase().includes(`/${c.name.toLowerCase()}/`) ? 1 : 0) -
              (a.toLowerCase().includes(`/${c.name.toLowerCase()}/`) ? 1 : 0),
          );
        const exportRx = new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${c.name}\\b`);
        hit = hits.find((p) => exportRx.test(readText(p))) ?? hits[0];
      }
      if (!hit || !existsSync(hit)) continue;
      c.srcPath = hit;
      c.doc = leadingJsdoc(readText(hit), c.name) || undefined;
      // group = last src/ path segment that isn't the component's own dir or
      // a generic container name — else JSDoc @category — else 'general'.
      c.group = slug(
        slash(relative(srcRoot, dirname(hit)))
          .split('/')
          .filter((s) => s && s.toLowerCase() !== c.name.toLowerCase() && !GENERIC_DIR.has(s.toLowerCase()))
          .at(-1)
        || (c.doc && /@category\s+(\S+)/.exec(c.doc)?.[1])
        || 'general',
      );
    }
  }

  console.error(
    `  package: ${components.length} components` +
      (srcRoot ? ` (${components.filter((c) => c.srcPath).length} src-matched)` : ' (no src/ — dist-only)'),
  );
  return { shape: 'package', entry, components, synthEntry, exported };
}
