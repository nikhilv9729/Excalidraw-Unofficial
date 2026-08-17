# Excalidraw Desktop (Unofficial)

An offline-first Windows desktop client powered by the official open-source
[`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw)
editor and [Tauri 2](https://v2.tauri.app/).

This is an independent community project. It is not endorsed by or affiliated
with Excalidraw or Excalidraw Plus.

## Features

- Native Windows NSIS and MSI installers
- Offline editing with local draft recovery
- Open, save, and associate `.excalidraw` files
- `Ctrl+N`, `Ctrl+O`, `Ctrl+S`, and `Ctrl+Shift+S` shortcuts
- Single-instance file opening
- Signed in-app updates from GitHub Releases
- Daily automated pull requests for official Excalidraw releases

## Development

Prerequisites: Node.js 22, pnpm 11, the Rust MSVC toolchain, WebView2, and the
Microsoft C++ build tools.

```powershell
pnpm install
pnpm desktop:dev
```

Build the web frontend only:

```powershell
pnpm build
```

Build Windows installers:

```powershell
pnpm desktop:build
```

Installers are written under `src-tauri/target/release/bundle/`.

## Configure signed updates

Tauri requires every update artifact to be cryptographically signed. Generate
an updater key pair once:

```powershell
pnpm tauri signer generate -w .tauri/excalidraw-desktop.key
```

Add these GitHub Actions repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: contents of the generated private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the key password
- `TAURI_UPDATER_PUBLIC_KEY`: contents of the generated public key

Keep the private key and password outside Git. Losing the key prevents existing
installations from accepting future updates.

Run the **Release Windows app** workflow. It substitutes the repository URL and
public key during the release build, creates NSIS/MSI installers, generates
signed update artifacts and `latest.json`, and opens a draft GitHub Release.
Review and publish the draft to make the update available.

## Following upstream

The daily **Check for Excalidraw updates** workflow updates the exact
`@excalidraw/excalidraw` dependency, synchronizes the desktop version, builds the
frontend, and opens a pull request. Review and merge the pull request, then run
the release workflow. This deliberately keeps a human approval point between an
upstream release and automatic distribution to installed desktops.

## Scope

The packaged editor, local drafts, and file operations work offline. Excalidraw
Plus accounts and the full excalidraw.com collaboration backend are not bundled.
The standard Excalidraw export tools remain available.
