import { readFile, writeFile } from "node:fs/promises";

const repository = process.env.GITHUB_REPOSITORY;
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
if (!repository || !publicKey) {
  throw new Error("GITHUB_REPOSITORY and TAURI_UPDATER_PUBLIC_KEY are required");
}

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
config.bundle.createUpdaterArtifacts = true;
config.plugins = {
  ...(config.plugins ?? {}),
  updater: {
    pubkey: publicKey,
    endpoints: [
      `https://github.com/${repository}/releases/latest/download/latest.json`,
    ],
    windows: { installMode: "passive" },
  },
};
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Configured updater for ${repository}`);
