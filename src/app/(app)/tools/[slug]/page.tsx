import { notFound } from "next/navigation";
import { getTool, isToolVisible, TOOLS } from "@/modules/registry";
import { UsageTracker } from "@/components/usage-tracker";
import { getCurrentUser } from "@/modules/auth/current-user";

/** Pre-render a page for every registered, ready tool. */
export function generateStaticParams() {
  return TOOLS.filter((t) => t.status === "ready").map((t) => ({
    slug: t.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  return { title: tool ? `${tool.name} — Lab` : "Lab" };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);

  if (!tool || tool.status !== "ready" || !tool.Component) {
    notFound();
  }

  if (tool.superadminOnly) {
    const user = await getCurrentUser();
    if (!isToolVisible(tool, user?.role)) notFound();
  }

  const { Component, name, description, wide } = tool;

  return (
    <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-4xl"} px-6 py-10`}>
      <UsageTracker slug={slug} />
      <header className="animate-enter mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>
      </header>
      <div className="animate-fade [animation-delay:60ms]">
        <Component />
      </div>
    </div>
  );
}
