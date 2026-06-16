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
  togglePreview: () => void;
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
      ],
    });

    const editMenu = await Submenu.new({
      text: "Edit",
      items: [
        await PredefinedMenuItem.new({ item: "Cut" }),
        await PredefinedMenuItem.new({ item: "Copy" }),
        await PredefinedMenuItem.new({ item: "Paste" }),
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

    const menu = await Menu.new({ items: [appMenu, fileMenu, editMenu, viewMenu] });
    await menu.setAsAppMenu();
  } catch (err) {
    console.warn("App menu setup skipped:", err);
  }
}
