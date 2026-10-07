import {
  Camera,
  FileImage,
  FileOutput,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Images,
  Layers,
  LayoutGrid,
  RotateCw,
  Scissors,
  Trash2,
} from "lucide-react";
import type { ToolIcon as ToolIconName } from "@/lib/tools/registry";

const MAP: Record<ToolIconName, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "file-plus": FilePlus2,
  images: Images,
  image: ImageIcon,
  "file-image": FileImage,
  "file-text": FileText,
  layers: Layers,
  scissors: Scissors,
  "layout-grid": LayoutGrid,
  "rotate-cw": RotateCw,
  trash: Trash2,
  "file-output": FileOutput,
  camera: Camera,
};

export function ToolIcon({ name, className }: { name: ToolIconName; className?: string }) {
  const Component = MAP[name] ?? FileText;
  return <Component className={className} strokeWidth={1.6} />;
}
