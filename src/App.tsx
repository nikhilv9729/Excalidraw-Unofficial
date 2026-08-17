import { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { loadScene, parseScene, serializeScene, type SceneSnapshot } from "./document";
import {
  chooseDrawingToOpen,
  chooseDrawingToSave,
  isTauri,
  onOpenDrawing,
  readDrawing,
  startupDrawing,
  writeDrawing,
} from "./native";

const DRAFT_KEY = "excalidraw-desktop:draft:v1";

function fileName(path: string | null) {
  if (!path) return "Untitled.excalidraw";
  return path.split(/[\\/]/).at(-1) ?? "Untitled.excalidraw";
}

export default function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const sceneRef = useRef<SceneSnapshot | null>(null);
  const loadingRef = useRef(false);
  const autosaveRef = useRef<number | null>(null);
  const recoveredDraftRef = useRef(localStorage.getItem(DRAFT_KEY));
  const initialChangeRef = useRef(true);

  useEffect(() => {
    document.title = `${dirty ? "• " : ""}${fileName(path)} — Excalidraw Desktop`;
  }, [dirty, path]);

  const openPath = useCallback(async (nextPath: string) => {
    if (!api) return;
    setBusy(true);
    setStatus("Opening…");
    try {
      const contents = await readDrawing(nextPath);
      loadingRef.current = true;
      loadScene(api, parseScene(contents));
      setPath(nextPath);
      setDirty(false);
      localStorage.removeItem(DRAFT_KEY);
      setStatus(`Opened ${fileName(nextPath)}`);
      window.setTimeout(() => {
        loadingRef.current = false;
      }, 0);
    } catch (error) {
      setStatus("Could not open drawing");
      await message(error instanceof Error ? error.message : String(error), {
        title: "Open drawing",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [api]);

  const saveDocument = useCallback(async (saveAs = false) => {
    if (!sceneRef.current || busy) return;
    let destination = saveAs ? null : path;
    if (!destination) {
      destination = await chooseDrawingToSave(path ?? "Untitled.excalidraw");
    }
    if (!destination) return;

    setBusy(true);
    setStatus("Saving…");
    try {
      await writeDrawing(destination, serializeScene(sceneRef.current));
      setPath(destination);
      setDirty(false);
      localStorage.removeItem(DRAFT_KEY);
      setStatus(`Saved ${fileName(destination)}`);
    } catch (error) {
      setStatus("Could not save drawing");
      await message(error instanceof Error ? error.message : String(error), {
        title: "Save drawing",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, path]);

  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true;
    return confirm("Discard the unsaved changes to this drawing?", {
      title: "Unsaved changes",
      kind: "warning",
    });
  }, [dirty]);

  const newDocument = useCallback(async () => {
    if (!api || !(await confirmDiscard())) return;
    loadingRef.current = true;
    api.resetScene();
    setPath(null);
    setDirty(false);
    localStorage.removeItem(DRAFT_KEY);
    setStatus("New drawing");
    window.setTimeout(() => {
      loadingRef.current = false;
    }, 0);
  }, [api, confirmDiscard]);

  const openDocument = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const selected = await chooseDrawingToOpen();
    if (selected) await openPath(selected);
  }, [confirmDiscard, openPath]);

  const checkForUpdates = useCallback(async () => {
    setBusy(true);
    setStatus("Checking for updates…");
    try {
      const update = await check();
      if (!update) {
        setStatus("You’re up to date");
        await message("You already have the latest version.", { title: "Updates" });
        return;
      }
      const shouldInstall = await confirm(
        `Version ${update.version} is available. Download and install it now?`,
        { title: "Update available" },
      );
      if (shouldInstall) {
        setStatus(`Downloading ${update.version}…`);
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (error) {
      setStatus("Update check unavailable");
      await message(
        `${error instanceof Error ? error.message : String(error)}\n\nThe release repository and updater key must be configured before publishing.`,
        { title: "Updates", kind: "error" },
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!api || !isTauri()) return;
    let unlisten: (() => void) | undefined;
    void startupDrawing().then((startupPath) => {
      if (startupPath) void openPath(startupPath);
    });
    void onOpenDrawing((nextPath) => void openPath(nextPath)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [api, openPath]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveDocument(event.shiftKey);
      } else if (key === "o") {
        event.preventDefault();
        void openDocument();
      } else if (key === "n") {
        event.preventDefault();
        void newDocument();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [newDocument, openDocument, saveDocument]);

  const onChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    sceneRef.current = { elements, appState, files };
    if (initialChangeRef.current) {
      initialChangeRef.current = false;
      setDirty(Boolean(recoveredDraftRef.current));
      return;
    }
    if (!loadingRef.current) setDirty(true);
    if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, serializeScene({ elements, appState, files }));
      } catch {
        // The editable file remains authoritative if browser storage is unavailable.
      }
    }, 500);
  }, []);

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="document-title" title={path ?? "Unsaved drawing"}>
          <span className="brand-mark" aria-hidden="true">◇</span>
          <span>{fileName(path)}</span>
          {dirty && <span className="dirty-mark" title="Unsaved changes">●</span>}
        </div>
        <nav className="document-actions" aria-label="Document actions">
          <button onClick={() => void newDocument()} disabled={busy}>New</button>
          <button onClick={() => void openDocument()} disabled={busy}>Open</button>
          <button className="primary" onClick={() => void saveDocument()} disabled={busy}>Save</button>
          <button onClick={() => void saveDocument(true)} disabled={busy}>Save as</button>
          <button onClick={() => void checkForUpdates()} disabled={busy}>Updates</button>
        </nav>
        <div className="status" role="status">{status}</div>
      </header>
      <section className="canvas-shell">
        <Excalidraw
          excalidrawAPI={setApi}
          onChange={onChange}
          initialData={() => {
            const draft = recoveredDraftRef.current;
            if (!draft) return null;
            try {
              return parseScene(draft);
            } catch {
              return null;
            }
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Separator />
            <MainMenu.Item onSelect={() => void checkForUpdates()}>
              Check for desktop updates
            </MainMenu.Item>
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.ItemLink href="https://github.com/excalidraw/excalidraw">
              Excalidraw source
            </MainMenu.ItemLink>
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Logo />
              <WelcomeScreen.Center.Heading>
                Excalidraw Desktop
              </WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <WelcomeScreen.Center.MenuItemLoadScene />
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </section>
    </main>
  );
}
