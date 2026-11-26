/**
 * Fork-only beta packaging: builds the tarballs uploaded to the rolling
 * `tray-beta` GitHub prerelease.
 *
 * Not part of the upstream release path. Run inside packages/native with
 * the platform .node binaries already placed by `napi artifacts` (the
 * napi directory layout: gpuix-native.<target>.node).
 *
 * What it produces (stable asset names, --clobber friendly):
 *   gpuix-native-aarch64-apple-darwin-beta.tgz   @gpuix/native-darwin-arm64
 *   gpuix-native-x86_64-unknown-linux-gnu-beta.tgz @gpuix/native-linux-x64-gnu
 *   gpuix-native-x86_64-pc-windows-msvc-beta.tgz   @gpuix/native-win32-x64-msvc
 *   gpuix-native-aarch64-pc-windows-msvc-beta.tgz  @gpuix/native-win32-arm64-msvc
 *   gpuix-native-beta.tgz                          @gpuix/native (cross-platform root)
 *
 * The root tarball keeps its package name but rewrites each
 * optionalDependencies entry to the stable GitHub release URL of the
 * matching platform tarball, so installing the root beta can never
 * resolve the upstream stable @gpuix/native from npm.
 *
 * See BETA.md for the user-facing contract.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const RELEASE_TAG = process.env.BETA_RELEASE_TAG ?? "tray-beta";
const REPO = process.env.BETA_REPO; // owner/repo, required for asset URLs
const VERSION_SUFFIX = process.env.BETA_VERSION_SUFFIX; // e.g. short commit sha
const PACK_OUT = process.env.BETA_PACK_OUT ?? "beta-dist";

if (!REPO) {
  console.error("BETA_REPO (owner/repo) is required");
  process.exit(1);
}

// Platform packages match packages/native/package.json napi.targets and
// the optionalDependencies of the published @gpuix/native.
// `file` is the napi npm-platform segment of the staged .node file name
// (napi artifacts writes gpuix-native.darwin-arm64.node, not the rust
// triple), while `target` keeps the rust triple for the stable asset name.
const PLATFORMS: Array<{ target: string; fileTag: string; npmPackage: string }> = [
  { target: "aarch64-apple-darwin", fileTag: "darwin-arm64", npmPackage: "@gpuix/native-darwin-arm64" },
  { target: "x86_64-unknown-linux-gnu", fileTag: "linux-x64-gnu", npmPackage: "@gpuix/native-linux-x64-gnu" },
  { target: "x86_64-pc-windows-msvc", fileTag: "win32-x64-msvc", npmPackage: "@gpuix/native-win32-x64-msvc" },
  { target: "aarch64-pc-windows-msvc", fileTag: "win32-arm64-msvc", npmPackage: "@gpuix/native-win32-arm64-msvc" },
];

function assetUrl(name: string): string {
  return `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${name}`;
}

function pack(dir: string, outDir: string): string {
  // --ignore-scripts keeps prepublishOnly guards and napi hooks out of the
  // pack step; we only ever pack, never publish.
  // bun writes the tarball relative to the packed directory unless given
  // an absolute --destination, and the flag is --destination (npm's --out
  // is silently ignored), so pass absolute and read it back from there.
  // Pack into a private directory so a shared output dir never holds two
  // tarballs at once, then move it to outDir.
  const staging = resolve(outDir, ".staging");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const res = spawnSync(
    "bun",
    ["pm", "pack", "--ignore-scripts", "--destination", staging],
    { cwd: dir, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (res.status !== 0) {
    throw new Error(`bun pm pack failed in ${dir}`);
  }
  const tgz = readdirSync(staging).filter((f) => f.endsWith(".tgz"));
  if (tgz.length !== 1) throw new Error(`expected one tarball in ${staging}, found ${tgz.join(", ")}`);
  const dest = join(resolve(outDir), tgz[0]);
  rmSync(dest, { force: true });
  spawnSync("mv", [join(staging, tgz[0]), dest], { stdio: "inherit" });
  rmSync(staging, { recursive: true, force: true });
  return dest;
}

function main() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (pkg.name !== "@gpuix/native") {
    throw new Error(`run this from packages/native, found package ${pkg.name}`);
  }

  const version = VERSION_SUFFIX ? `${pkg.version}-${VERSION_SUFFIX}` : pkg.version;
  mkdirSync(PACK_OUT, { recursive: true });

  // 1. Platform tarballs: reproduce the napi artifacts layout, then pack a
  //    stub package per platform that carries only the .node file.
  const rewrittenOptional: Record<string, string> = {};
  const packed: Array<{ file: string; asset: string }> = [];

  for (const { target, fileTag, npmPackage } of PLATFORMS) {
    const nodeFile = `${pkg.napi.binaryName}.${fileTag}.node`;
    if (!existsSync(nodeFile)) {
      throw new Error(`missing binary for ${target}: ${nodeFile}. Run \`napi artifacts\` first.`);
    }

    const dir = join(PACK_OUT, target);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // napi's layout: <npmPackage>/gpuix-native.<target>.node
    mkdirSync(join(dir, npmPackage), { recursive: true });
    spawnSync("cp", [nodeFile, join(dir, npmPackage, nodeFile)], { stdio: "inherit" });

    const platformPkg = {
      name: npmPackage,
      version,
      os: target.includes("darwin")
        ? "darwin"
        : target.includes("linux")
          ? "linux"
          : "win32",
      cpu: target.startsWith("aarch64") || target.startsWith("arm64")
        ? "arm64"
        : "x64",
      main: "index.js",
      files: [nodeFile, "index.js"],
    };
    writeFileSync(
      join(dir, npmPackage, "index.js"),
      `// napi-generated platform loader stub for ${npmPackage}\n` +
        `module.exports = require('./${nodeFile}')\n`,
    );
    writeFileSync(join(dir, npmPackage, "package.json"), JSON.stringify(platformPkg, null, 2) + "\n");

    const asset = `gpuix-native-${target}-beta.tgz`;
    const file = pack(join(dir, npmPackage), PACK_OUT);
    // pack writes <out>/<name>-<version>.tgz; rename to the stable asset name
    rmSync(join(PACK_OUT, "beta"), { recursive: true, force: true });
    const packedName = basename(file);
    const stable = join(PACK_OUT, asset);
    rmSync(stable, { force: true });
    spawnSync("mv", [file, stable], { stdio: "inherit" });
    packed.push({ file: stable, asset });
    rewrittenOptional[npmPackage] = assetUrl(asset);
    console.log(`packed ${npmPackage} -> ${asset}`);
  }

  // 2. Root @gpuix/native tarball: same package name and contents, but each
  //    optionalDependencies value points at the platform tarball URL on the
  //    rolling release. That is what makes one root tarball cross-platform.
  const rootDir = join(PACK_OUT, "root");
  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(rootDir, { recursive: true });
  for (const f of pkg.files ?? []) {
    const src = join(".", f);
    if (!existsSync(src)) continue; // e.g. wasm, dist may be conditional
    spawnSync("cp", ["-r", src, join(rootDir, f)], { stdio: "inherit" });
  }
  const rootPkg = { ...pkg, version, optionalDependencies: rewrittenOptional };
  delete rootPkg.napi; // fork beta, not published to npm
  delete rootPkg.publishConfig;
  delete rootPkg.scripts;
  writeFileSync(join(rootDir, "package.json"), JSON.stringify(rootPkg, null, 2) + "\n");

  const rootAsset = "gpuix-native-beta.tgz";
  const rootFile = pack(rootDir, PACK_OUT);
  const stableRoot = join(PACK_OUT, rootAsset);
  rmSync(stableRoot, { force: true });
  spawnSync("mv", [rootFile, stableRoot], { stdio: "inherit" });
  console.log(`packed @gpuix/native -> ${rootAsset}`);

  // 3. Adapter tarballs. The packaging job builds react/solid after
  //    `bun install`; this script rewrites their @gpuix/native dependency to
  //    the root tarball URL and packs the build output.
  for (const adapter of ["react", "solid"]) {
    const srcDir = `../${adapter}`;
    const adapterPkgPath = join(srcDir, "package.json");
    if (!existsSync(adapterPkgPath)) continue;
    const adapterPkg = JSON.parse(readFileSync(adapterPkgPath, "utf8"));
    if (adapterPkg.dependencies?.["@gpuix/native"]) {
      adapterPkg.dependencies["@gpuix/native"] = assetUrl(rootAsset);
    } else {
      // a tarball install must not silently fall back to npm
      throw new Error(`${adapter} has no @gpuix/native dependency to rewrite`);
    }
    const outDir = join(PACK_OUT, adapter);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const f of adapterPkg.files ?? []) {
      if (!existsSync(join(srcDir, f))) {
        throw new Error(`${adapter}: files entry missing, run its build first: ${f}`);
      }
      spawnSync("cp", ["-r", join(srcDir, f), join(outDir, f)], { stdio: "inherit" });
    }
    const rewritten = { ...adapterPkg, version };
    delete rewritten.scripts;
    delete rewritten.publishConfig;
    writeFileSync(join(outDir, "package.json"), JSON.stringify(rewritten, null, 2) + "\n");

    const asset = `gpuix-${adapter}-beta.tgz`;
    const file = pack(outDir, PACK_OUT);
    const stable = join(PACK_OUT, asset);
    rmSync(stable, { force: true });
    spawnSync("mv", [file, stable], { stdio: "inherit" });
    console.log(`packed @gpuix/${adapter} -> ${asset}`);
    packed.push({ file: stable, asset });
  }

  packed.push({ file: stableRoot, asset: rootAsset });
  console.log("\nAssets:");
  for (const { asset } of packed) console.log(`  ${PACK_OUT}/${asset}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
