import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

const drawingFilter = [{ name: "Excalidraw drawing", extensions: ["excalidraw"] }];

export const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function chooseDrawingToOpen(): Promise<string | null> {
  const selected = await open({ multiple: false, directory: false, filters: drawingFilter });
  return typeof selected === "string" ? selected : null;
}

export async function chooseDrawingToSave(defaultPath?: string): Promise<string | null> {
  return save({ defaultPath, filters: drawingFilter });
}

export async function readDrawing(path: string): Promise<string> {
  return invoke<string>("read_drawing", { path });
}

export async function writeDrawing(path: string, contents: string): Promise<void> {
  return invoke("write_drawing", { path, contents });
}

export async function startupDrawing(): Promise<string | null> {
  return invoke<string | null>("startup_drawing");
}

export function onOpenDrawing(handler: (path: string) => void) {
  return listen<string>("open-drawing", ({ payload }) => handler(payload));
}
