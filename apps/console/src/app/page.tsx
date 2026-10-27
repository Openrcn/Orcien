"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchOrganizations } from "@/lib/org";

/**
 * Landing page: redirects to the first organization's console URL
 * (e.g. /default/deployments). The rest of the console lives under
 * /<org-slug>/... with the slug owned by the backend.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchOrganizations().then((orgs) => {
      if (cancelled) return;
      const slug = (orgs && orgs[0]?.Slug) || "default";
      router.replace(`/${slug}/deployments`);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
