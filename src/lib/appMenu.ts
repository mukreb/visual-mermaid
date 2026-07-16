// Native macOS menu bar (Tauri only). Built defensively: dynamically imported,
// no-op in a browser, and wrapped in try/catch so a menu-API mismatch can never
// break the app — the toolbar covers every action regardless.
//
// Accelerators live on the menu items, so they only fire inside the desktop app;
// the browser-dev keyboard fallback lives in App.tsx (guarded by isTauri()).

import { isTauri } from "./tauriFiles";

export interface MenuHandlers {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  togglePreview: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddNode: () => void;
  onCycleDirection: () => void;
}

export async function setupAppMenu(handlers: MenuHandlers): Promise<void> {
  if (!isTauri()) return;
  try {
    const { Menu, Submenu, MenuItem, PredefinedMenuItem } = await import(
      "@tauri-apps/api/menu"
    );
    const sep = () => PredefinedMenuItem.new({ item: "Separator" });

    const appMenu = await Submenu.new({
      text: "Visual Mermaid",
      items: [await sep(), await PredefinedMenuItem.new({ item: "Quit" })],
    });

    const fileMenu = await Submenu.new({
      text: "File",
      items: [
        await MenuItem.new({
          text: "New",
          accelerator: "CmdOrCtrl+N",
          action: () => handlers.onNew(),
        }),
        await MenuItem.new({
          text: "Open…",
          accelerator: "CmdOrCtrl+O",
          action: () => handlers.onOpen(),
        }),
        await sep(),
        await MenuItem.new({
          text: "Save",
          accelerator: "CmdOrCtrl+S",
          action: () => handlers.onSave(),
        }),
        await MenuItem.new({
          text: "Save As…",
          accelerator: "CmdOrCtrl+Shift+S",
          action: () => handlers.onSaveAs(),
        }),
        await sep(),
        await MenuItem.new({
          text: "Export as SVG…",
          accelerator: "CmdOrCtrl+Shift+E",
          action: () => handlers.onExportSvg(),
        }),
        await MenuItem.new({
          text: "Export as PNG…",
          action: () => handlers.onExportPng(),
        }),
      ],
    });

    const editMenu = await Submenu.new({
      text: "Edit",
      items: [
        // No accelerator: a menu-registered CmdOrCtrl+Z would be caught by the
        // OS before it ever reaches the webview, breaking Monaco/input-field
        // undo. The focus-aware global keydown listener in App.tsx already
        // owns ⌘Z/⇧⌘Z (in the app and the browser) and calls these same
        // store actions when focus isn't in a text control.
        await MenuItem.new({
          text: "Undo",
          action: () => handlers.onUndo(),
        }),
        await MenuItem.new({
          text: "Redo",
          action: () => handlers.onRedo(),
        }),
        await sep(),
        await PredefinedMenuItem.new({ item: "Cut" }),
        await PredefinedMenuItem.new({ item: "Copy" }),
        await PredefinedMenuItem.new({ item: "Paste" }),
        await sep(),
        await PredefinedMenuItem.new({ item: "SelectAll" }),
      ],
    });

    const viewMenu = await Submenu.new({
      text: "View",
      items: [
        await MenuItem.new({
          text: "Toggle Preview",
          accelerator: "CmdOrCtrl+Alt+P",
          action: () => handlers.togglePreview(),
        }),
      ],
    });

    const flowchartMenu = await Submenu.new({
      text: "Flowchart",
      items: [
        await MenuItem.new({
          text: "Add Node",
          action: () => handlers.onAddNode(),
        }),
        await MenuItem.new({
          text: "Cycle Layout Direction",
          action: () => handlers.onCycleDirection(),
        }),
      ],
    });

    const menu = await Menu.new({ items: [appMenu, fileMenu, editMenu, viewMenu, flowchartMenu] });
    await menu.setAsAppMenu();
  } catch (err) {
    console.warn("App menu setup skipped:", err);
  }
}
