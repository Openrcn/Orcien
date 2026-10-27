"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { apiOrigin } from "./api";
import { setOrg, getOrgSnapshot, type OrgStore } from "./org-store";

export type { OrgStore } from "./org-store";

const DEFAULT_STORE: OrgStore = { slug: "", org: null, resolved: false };

export interface Organization {
  ID: string;
  Slug: string;
  Name: string;
  Description: string;
}

const OrgContext = createContext<OrgStore>(DEFAULT_STORE);

/**
 * Lists organizations from the gateway (this endpoint is not org-scoped).
 * Returns null when the gateway is unreachable (vs [] when there are none).
 */
export async function fetchOrganizations(): Promise<Organization[] | null> {
  try {
    const res = await fetch(`${apiOrigin()}/api/v1/organizations`);
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Organization[] | null;
  } catch {
    return null;
  }
}

/**
 * Derives the org context from the current URL (`/<org-slug>/...`).
 * Resolves the matching organization (and thus its ID) from the gateway so
 * org-scoped API calls can send `X-Organization-ID`.
 */
export function OrgProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const slug = pathname === "/" ? "" : pathname.split("/")[1];
  const [org, setResolved] = useState<Organization | null>(null);
  const [resolved, setResolvedFlag] = useState(false);

  // The URL segment is known synchronously; publish it right away and drop
  // any previously resolved org when switching between org segments.
  if (getOrgSnapshot().slug !== slug) {
    setOrg({ slug, org: null, resolved: false });
    setResolvedFlag(false);
  }

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchOrganizations().then((orgs) => {
      if (cancelled) return;
      // Only trust the lookup when the gateway actually responded.
      if (orgs === null) return;
      const match = orgs.find((o) => o.Slug === slug) || null;
      setResolved(match);
      setResolvedFlag(true);
      setOrg({ slug, org: match, resolved: true });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const value = useMemo(() => ({ slug, org, resolved }), [slug, org, resolved]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

/** Current org context: URL slug + resolved organization (if any). */
export function useOrg(): OrgStore {
  return useContext(OrgContext);
}

/**
 * Builds an internal app path scoped to the org in the current URL.
 * e.g. with useOrgHref() on /acme/... : ("/deployments") -> "/acme/deployments"
 */
export function useOrgHref() {
  const { slug } = useOrg();
  return (path: string) => (slug ? `/${slug}${path}` : path);
}
