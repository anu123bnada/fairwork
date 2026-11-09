// Recommendations from a person's own skills: published listings whose title or description mentions at least one of them. It only ranks listings that exist on the platform
// (created by organizations); it never invents jobs, never ranks people, and says which skill matched so the reason can be checked.
export type ListingForMatch = { id: string; title: string; description: string; location: string; companyName: string | null };
export type ListingMatch<T extends ListingForMatch = ListingForMatch> = { listing: T; matched: string[] };

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const mentions = (haystack: string, skill: string) => {
  const needle = normalize(skill);
  if (needle.length < 2) return false;
  // Short skills ("c", "it", "sql") must match as whole words so "it" does not match "with".
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
};

export function matchListings<T extends ListingForMatch>(skills: string[], listings: readonly T[], limit = 5): ListingMatch<T>[] {
  const wanted = [...new Set(skills.map(normalize).filter(Boolean))];
  return listings
    .map(listing => {
      const haystack = normalize(`${listing.title} ${listing.description}`);
      return { listing, matched: wanted.filter(skill => mentions(haystack, skill)) };
    })
    .filter(item => item.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || (a.listing.title < b.listing.title ? -1 : 1))
    .slice(0, limit);
}
