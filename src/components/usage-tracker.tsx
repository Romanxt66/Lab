"use client";

import * as React from "react";
import { recordToolVisit } from "@/lib/usage";

/**
 * Records a tool visit (client-side) when a tool page mounts. Rendered inside
 * the tool page; invisible. Re-records when the slug changes.
 */
export function UsageTracker({ slug }: { slug: string }) {
  React.useEffect(() => {
    recordToolVisit(slug);
  }, [slug]);
  return null;
}
