import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { serializeAsJSON } from "@excalidraw/excalidraw";

export type SceneSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

export function serializeScene(scene: SceneSnapshot): string {
  return serializeAsJSON(scene.elements, scene.appState, scene.files, "local");
}

export function parseScene(text: string): ExcalidrawInitialDataState {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file does not contain an Excalidraw drawing.");
  }

  const drawing = parsed as Record<string, unknown>;
  if (drawing.type !== "excalidraw" || !Array.isArray(drawing.elements)) {
    throw new Error("This file is not a valid .excalidraw document.");
  }

  return {
    elements: drawing.elements as ExcalidrawInitialDataState["elements"],
    appState: (drawing.appState ?? {}) as ExcalidrawInitialDataState["appState"],
    files: (drawing.files ?? {}) as ExcalidrawInitialDataState["files"],
    scrollToContent: true,
  };
}

export function loadScene(api: ExcalidrawImperativeAPI, scene: ExcalidrawInitialDataState) {
  api.updateScene({
    elements: scene.elements ?? [],
    appState: (scene.appState ?? {}) as AppState,
  });
  if (scene.files) {
    api.addFiles(Object.values(scene.files));
  }
  api.scrollToContent(scene.elements ?? [], { fitToContent: true });
}
