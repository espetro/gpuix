# GPUIX tray beta (fork-only rolling release)

This is a **fork prerelease**, not an upstream npm release. Nothing here is
published to the npm registry. On every push to the `beta/tray` branch, CI
builds the native binaries and replaces the assets of a single rolling
GitHub prerelease tagged [`tray-beta`] in **place**, keeping the same
download URLs. The beta disappears when the tray work merges upstream and
ships as a normal versioned release.

## Install

Pick the adapter you use. Both Bun and npm accept tarball URLs as
dependency specs.

### Bun

```bash
bun add https://github.com/OWNER/gpuix/releases/download/tray-beta/gpuix-react-beta.tgz
```

or, for Solid:

```bash
bun add https://github.com/OWNER/gpuix/releases/download/tray-beta/gpuix-solid-beta.tgz
```

`OWNER` is the fork owner; for the main fork it is `remorses`. The exact
URLs are listed on the [tray-beta release page].

### npm

```bash
npm install https://github.com/OWNER/gpuix/releases/download/tray-beta/gpuix-react-beta.tgz
```

`@gpuix/native` is pulled in automatically as a dependency. Do not install
it yourself unless you want the root native package directly:

```bash
npm install https://github.com/OWNER/gpuix/releases/download/tray-beta/gpuix-native-beta.tgz
```

## Stable URLs

Asset names never change, even though their contents are replaced on each
push:

- `gpuix-react-beta.tgz` — `@gpuix/react`
- `gpuix-solid-beta.tgz` — `@gpuix/solid`
- `gpuix-native-beta.tgz` — `@gpuix/native`, cross-platform
- `gpuix-native-aarch64-apple-darwin-beta.tgz` — `@gpuix/native-darwin-arm64`
- `gpuix-native-x86_64-unknown-linux-gnu-beta.tgz` — `@gpuix/native-linux-x64-gnu`
- `gpuix-native-x86_64-pc-windows-msvc-beta.tgz` — `@gpuix/native-win32-x64-msvc`
- `gpuix-native-aarch64-pc-windows-msvc-beta.tgz` — `@gpuix/native-win32-arm64-msvc`

Every URL is
`https://github.com/OWNER/gpuix/releases/download/tray-beta/<asset name>`.
Package versions inside the tarballs carry the build commit SHA, so an
installed copy can always be traced to the exact `beta/tray` commit.

## Dependency-identity guarantee

The platform tarballs (e.g. `@gpuix/native-darwin-arm64`) are **not** the
root `@gpuix/native` package. They are the per-platform binary packages the
root package references through its `optionalDependencies`. The beta root
`@gpuix/native` tarball rewrites each of those entries to the stable GitHub
URL of the matching platform tarball, so one root tarball installs the
right binary on every OS. The React and Solid tarballs similarly depend on
the root native tarball **by URL**.

The consequence: if you install the beta `@gpuix/react` or `@gpuix/solid`
tarball, the `@gpuix/native` you get is the fork's rolling beta, never the
stable upstream package from npm. The beta cannot silently mix with an
older or newer released native binary, and an upstream `@gpuix/native`
install cannot accidentally pick up fork beta behavior.

## Updating

The release is replaced in place: `bun update` / `npm update` re-resolves
the URL and fetches the current asset. To move back to stable, remove the
tarball entries and install the published versions from npm.

## Current limitations

- The tray feature itself is still in progress; the exact public tray API
  may change between builds without notice. This document deliberately
  does not describe the tray API.
- No Windows `x64`/Linux musl, no universal macOS binaries. The target set
  matches the upstream CI matrix: darwin-arm64, linux-x64-gnu,
  win32-x64-msvc, win32-arm64.
- `bun pm pack --ignore-scripts` is used for all tarballs, so no postinstall
  steps run; none are needed today.
- The rolling release is a prerelease: GitHub does not mark it `latest`,
  and semver ranges never match it. You only get beta updates by
  re-resolving the tarball URL.

[`tray-beta`]: https://github.com/remorses/gpuix/releases/tag/tray-beta
[tray-beta release page]: https://github.com/remorses/gpuix/releases/tag/tray-beta
