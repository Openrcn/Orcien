import type { Organization } from "./org";

export interface OrgStore {
  slug: string;
  org: Organization | null;
  /** True once the org lookup for the current slug has completed. */
  resolved: boolean;
}

// Module-level store so the plain (non-hook) fetch helpers can read the
// current organization id without threading context through every caller.
let store: OrgStore = { slug: "", org: null, resolved: false };

export function getOrgSnapshot(): OrgStore {
  return store;
}

export function setOrg(next: OrgStore) {
  store = next;
}
