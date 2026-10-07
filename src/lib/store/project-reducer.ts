/**
 * Project state. A plain reducer so page operations stay pure, testable and
 * trivially undoable.
 */
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_PDF_SETTINGS,
  type CropRect,
  type PageAdjustments,
  type PdfSettings,
  type ProjectPage,
  type Quad,
  type Rotation,
  type SourceFile,
} from "@/lib/core/types";
import { move, uid } from "@/lib/core/utils";

export interface ProjectState {
  files: Record<string, SourceFile>;
  pages: ProjectPage[];
  /** Page ids, in click order. */
  selection: string[];
  settings: PdfSettings;
  past: Snapshot[];
  future: Snapshot[];
}

interface Snapshot {
  pages: ProjectPage[];
  selection: string[];
}

export type ProjectAction =
  | { type: "import"; files: SourceFile[]; pages: ProjectPage[]; at?: number }
  | { type: "remove-pages"; ids: string[] }
  | { type: "remove-file"; fileId: string }
  | { type: "reorder"; from: number; to: number }
  | { type: "reorder-many"; ids: string[]; to: number }
  | { type: "rotate"; ids: string[]; delta: 90 | -90 | 180 }
  | { type: "set-rotation"; ids: string[]; rotation: Rotation }
  | { type: "duplicate"; ids: string[] }
  | { type: "set-crop"; id: string; crop?: CropRect }
  | { type: "set-quad"; id: string; quad?: Quad }
  | { type: "set-adjustments"; ids: string[]; adjustments: Partial<PageAdjustments> }
  | { type: "reset-page"; ids: string[] }
  | { type: "replace-page"; id: string; file: SourceFile; page: ProjectPage }
  | { type: "sort-by-name" }
  | { type: "reverse" }
  | { type: "select"; ids: string[]; mode?: "set" | "toggle" | "range" }
  | { type: "select-all" }
  | { type: "clear-selection" }
  | { type: "set-settings"; settings: Partial<PdfSettings> }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

export const initialProjectState: ProjectState = {
  files: {},
  pages: [],
  selection: [],
  settings: { ...DEFAULT_PDF_SETTINGS },
  past: [],
  future: [],
};

const HISTORY_LIMIT = 40;

/** Actions that change page content/order and should be undoable. */
const UNDOABLE = new Set<ProjectAction["type"]>([
  "import",
  "remove-pages",
  "remove-file",
  "reorder",
  "reorder-many",
  "rotate",
  "set-rotation",
  "duplicate",
  "set-crop",
  "set-quad",
  "set-adjustments",
  "reset-page",
  "replace-page",
  "sort-by-name",
  "reverse",
]);

function snapshot(state: ProjectState): Snapshot {
  return { pages: state.pages, selection: state.selection };
}

function pushHistory(state: ProjectState): Pick<ProjectState, "past" | "future"> {
  return {
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
  };
}

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
function addRotation(current: Rotation, delta: number): Rotation {
  const index = (ROTATIONS.indexOf(current) + delta / 90 + 8) % 4;
  return ROTATIONS[index];
}

/** Natural sort so "img2.jpg" sorts before "img10.jpg". */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function mapPages(pages: ProjectPage[], ids: string[], fn: (page: ProjectPage) => ProjectPage): ProjectPage[] {
  const set = new Set(ids);
  return pages.map((page) => (set.has(page.id) ? fn(page) : page));
}

/** Drop files that no longer back any page. */
function pruneFiles(files: Record<string, SourceFile>, pages: ProjectPage[]): Record<string, SourceFile> {
  const used = new Set(pages.map((page) => page.fileId));
  const next: Record<string, SourceFile> = {};
  let changed = false;
  for (const [id, file] of Object.entries(files)) {
    if (used.has(id)) next[id] = file;
    else changed = true;
  }
  return changed ? next : files;
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  const history = UNDOABLE.has(action.type) ? pushHistory(state) : { past: state.past, future: state.future };

  switch (action.type) {
    case "import": {
      if (!action.pages.length) return state;
      const files = { ...state.files };
      action.files.forEach((file) => {
        files[file.id] = file;
      });
      const at = action.at ?? state.pages.length;
      const pages = [...state.pages.slice(0, at), ...action.pages, ...state.pages.slice(at)];
      return { ...state, ...history, files, pages, selection: [] };
    }

    case "remove-pages": {
      const ids = new Set(action.ids);
      if (!ids.size) return state;
      const pages = state.pages.filter((page) => !ids.has(page.id));
      if (pages.length === state.pages.length) return state;
      return {
        ...state,
        ...history,
        pages,
        files: pruneFiles(state.files, pages),
        selection: state.selection.filter((id) => !ids.has(id)),
      };
    }

    case "remove-file": {
      const pages = state.pages.filter((page) => page.fileId !== action.fileId);
      if (pages.length === state.pages.length) return state;
      const remaining = new Set(pages.map((page) => page.id));
      return {
        ...state,
        ...history,
        pages,
        files: pruneFiles(state.files, pages),
        selection: state.selection.filter((id) => remaining.has(id)),
      };
    }

    case "reorder": {
      if (action.from === action.to) return state;
      return { ...state, ...history, pages: move(state.pages, action.from, action.to) };
    }

    case "reorder-many": {
      const ids = new Set(action.ids);
      const moving = state.pages.filter((page) => ids.has(page.id));
      if (!moving.length) return state;
      const rest = state.pages.filter((page) => !ids.has(page.id));
      // `to` is an index in the original list; translate it to the gap list.
      const before = state.pages.slice(0, action.to).filter((page) => !ids.has(page.id)).length;
      const pages = [...rest.slice(0, before), ...moving, ...rest.slice(before)];
      return { ...state, ...history, pages };
    }

    case "rotate": {
      if (!action.ids.length) return state;
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, action.ids, (page) => ({
          ...page,
          rotation: addRotation(page.rotation, action.delta),
        })),
      };
    }

    case "set-rotation":
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, action.ids, (page) => ({ ...page, rotation: action.rotation })),
      };

    case "duplicate": {
      const ids = new Set(action.ids);
      if (!ids.size) return state;
      const pages: ProjectPage[] = [];
      state.pages.forEach((page) => {
        pages.push(page);
        if (ids.has(page.id)) pages.push({ ...page, id: uid("page") });
      });
      return { ...state, ...history, pages };
    }

    case "set-crop":
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, [action.id], (page) => ({ ...page, crop: action.crop, quad: undefined })),
      };

    case "set-quad":
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, [action.id], (page) => ({ ...page, quad: action.quad, crop: undefined })),
      };

    case "set-adjustments":
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, action.ids, (page) => ({
          ...page,
          adjustments: { ...page.adjustments, ...action.adjustments },
        })),
      };

    case "reset-page":
      return {
        ...state,
        ...history,
        pages: mapPages(state.pages, action.ids, (page) => ({
          ...page,
          rotation: 0,
          crop: undefined,
          quad: undefined,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        })),
      };

    case "replace-page": {
      const index = state.pages.findIndex((page) => page.id === action.id);
      if (index === -1) return state;
      const pages = state.pages.slice();
      pages[index] = { ...action.page, id: action.id };
      return {
        ...state,
        ...history,
        files: pruneFiles({ ...state.files, [action.file.id]: action.file }, pages),
        pages,
      };
    }

    case "sort-by-name": {
      const pages = state.pages
        .map((page, index) => ({ page, index }))
        .sort((a, b) => {
          const byName = naturalCompare(a.page.label, b.page.label);
          return byName !== 0 ? byName : a.index - b.index;
        })
        .map((entry) => entry.page);
      return { ...state, ...history, pages };
    }

    case "reverse":
      return { ...state, ...history, pages: state.pages.slice().reverse() };

    case "select": {
      const { ids, mode = "set" } = action;
      if (mode === "toggle") {
        const next = new Set(state.selection);
        ids.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
        return { ...state, selection: state.pages.filter((p) => next.has(p.id)).map((p) => p.id) };
      }
      if (mode === "range") {
        const anchorId = state.selection[state.selection.length - 1] ?? state.pages[0]?.id;
        const anchor = state.pages.findIndex((p) => p.id === anchorId);
        const target = state.pages.findIndex((p) => p.id === ids[0]);
        if (anchor === -1 || target === -1) return { ...state, selection: ids };
        const [from, to] = anchor <= target ? [anchor, target] : [target, anchor];
        return { ...state, selection: state.pages.slice(from, to + 1).map((p) => p.id) };
      }
      return { ...state, selection: ids };
    }

    case "select-all":
      return { ...state, selection: state.pages.map((page) => page.id) };

    case "clear-selection":
      return state.selection.length ? { ...state, selection: [] } : state;

    case "set-settings":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        pages: previous.pages,
        selection: previous.selection,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        pages: next.pages,
        selection: next.selection,
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }

    case "reset":
      // Keep page-setup preferences, but let the next import name the output.
      return {
        ...initialProjectState,
        settings: { ...state.settings, fileName: DEFAULT_PDF_SETTINGS.fileName },
      };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Selectors
 * ------------------------------------------------------------------ */

export function filesAsMap(state: ProjectState): Map<string, SourceFile> {
  return new Map(Object.entries(state.files));
}

export function selectedPages(state: ProjectState): ProjectPage[] {
  const set = new Set(state.selection);
  return state.pages.filter((page) => set.has(page.id));
}

export interface FileSummary {
  file: SourceFile;
  pageCount: number;
}

/** Imported files in the order their first page appears. */
export function fileSummaries(state: ProjectState): FileSummary[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  state.pages.forEach((page) => {
    if (!counts.has(page.fileId)) order.push(page.fileId);
    counts.set(page.fileId, (counts.get(page.fileId) ?? 0) + 1);
  });
  return order
    .map((id) => {
      const file = state.files[id];
      return file ? { file, pageCount: counts.get(id) ?? 0 } : null;
    })
    .filter((entry): entry is FileSummary => entry !== null);
}
