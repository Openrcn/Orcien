"use client";

import { notFound } from "next/navigation";
import { useOrg } from "@/lib/org";

/**
 * Rejects URLs whose org segment does not match any known organization
 * once the org lookup has completed.
 */
export default function OrgNotFoundGuard() {
  const { slug, org, resolved } = useOrg();
  if (resolved && slug && !org) notFound();
  return null;
}
