import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";
import { ToolGrid } from "@/components/layout/ToolCard";
import { TOOLS, getTool } from "@/lib/tools/registry";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return { title: tool.title, description: tool.description };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const related = TOOLS.filter((item) => item.category === tool.category && item.slug !== tool.slug).slice(0, 6);

  return (
    <>
      <Workspace tool={tool} />
      {related.length ? (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-3 pb-12 sm:px-5">
          <hr className="border-line" />
          <ToolGrid tools={related} title="Related tools" />
        </div>
      ) : null}
    </>
  );
}
