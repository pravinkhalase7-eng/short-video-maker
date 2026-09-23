export function matchesSearchText(
  text: string | undefined,
  searchTerm: string,
): boolean {
  if (!text) {
    return false;
  }
  const hay = text.toLowerCase().replace(/[_/-]+/g, " ");
  const words = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) {
    return false;
  }
  return words.every((word) => hay.includes(word));
}

export function searchQueriesFor(terms: string[]): string[] {
  const cleaned = terms.map((term) => term.trim()).filter(Boolean);
  const queries = [];
  if (cleaned.length >= 2) {
    queries.push(`${cleaned[0]} ${cleaned[1]}`);
  }
  queries.push(...cleaned);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const query of queries) {
    if (!seen.has(query)) {
      seen.add(query);
      unique.push(query);
    }
  }
  return unique;
}
