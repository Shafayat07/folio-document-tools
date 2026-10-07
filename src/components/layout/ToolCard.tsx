import Link from "next/link";
import { ToolIcon } from "@/components/ui/ToolIcon";
import type { ToolDefinition } from "@/lib/tools/registry";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex items-start gap-3 rounded border border-line bg-surface p-3.5 transition-colors hover:border-ink-300 hover:bg-subtle"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-subtle text-ink-500 transition-colors group-hover:border-line-strong group-hover:text-ink">
        <ToolIcon name={tool.icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{tool.title}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-ink-500">{tool.blurb}</span>
      </span>
    </Link>
  );
}

export function ToolGrid({ tools, title, description }: { tools: ToolDefinition[]; title?: string; description?: string }) {
  return (
    <section>
      {title ? (
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-ink-500">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
