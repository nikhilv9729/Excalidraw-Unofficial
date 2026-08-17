import { readFile, writeFile } from "node:fs/promises";

const packagePath = new URL("../package.json", import.meta.url);
const tauriConfigPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const cargoPath = new URL("../src-tauri/Cargo.toml", import.meta.url);

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const version = packageJson.dependencies["@excalidraw/excalidraw"];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Expected an exact Excalidraw version, received: ${version}`);
}

packageJson.version = version;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
tauriConfig.version = version;
await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargo = await readFile(cargoPath, "utf8");
await writeFile(cargoPath, cargo.replace(/^version = ".*"$/m, `version = "${version}"`));
console.log(`Synchronized desktop version to Excalidraw ${version}`);
