import { Workspace } from "@/components/workspace/Workspace";
import { ToolGrid } from "@/components/layout/ToolCard";
import { HOME_TOOL, toolsByCategory } from "@/lib/tools/registry";

export default function HomePage() {
  return (
    <>
      {/* The tool is the landing experience — no marketing hero. */}
      <Workspace tool={HOME_TOOL} />

      <div className="mx-auto w-full max-w-[1400px] space-y-8 px-3 pb-12 sm:px-5">
        <hr className="border-line" />
        <ToolGrid
          tools={toolsByCategory("image")}
          title="Image tools"
          description="Build PDFs from photos, scans and exported images."
        />
        <ToolGrid tools={toolsByCategory("pdf")} title="PDF tools" description="Convert, split, merge and reorganise existing PDFs." />
      </div>
    </>
  );
}
