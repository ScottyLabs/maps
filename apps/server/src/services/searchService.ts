import { requestRuntime } from "../lib/mapRuntime.ts";
import { prisma } from "../../prisma/index.ts";
import type { GeoCoordinate } from "@cmumaps/common";
import { getSearchContext } from "../utils/search/build.ts";
import { parseQuery } from "../utils/search/parse.ts";
import { BM25Term, distanceWeightedScore, topN } from "../utils/search/rank.ts";
import type { Document } from "../utils/search/types.ts";

const DEFAULT_NUM_RESULTS = 20;

// Cache the search context (index, documents, and avgDl)
export type SearchContext = Awaited<ReturnType<typeof getSearchContext>> & {
  avgDl: number;
};
let searchContextCache: SearchContext | null = null;

export function activeSearchContext(): SearchContext {
  if (!searchContextCache) throw new Error("Search cache is not ready");
  return searchContextCache;
}

/**
 * Calculate average document length from a collection of documents.
 */
function calculateAvgDl(documents: Record<string, Document>): number {
  const numDocs = Object.keys(documents).length;
  if (numDocs === 0) return 0;
  let total = 0;
  for (const doc of Object.values(documents)) {
    total += doc.numTerms;
  }
  return total / numDocs;
}

export async function prepareSearchContext(database = prisma) {
  const context = await getSearchContext(database);
  return { ...context, avgDl: calculateAvgDl(context.documents) };
}

export function activateSearchContext(
  context: Awaited<ReturnType<typeof prepareSearchContext>>,
) {
  searchContextCache = context;
}

async function getOrBuildSearchContext() {
  const context = requestRuntime();
  if (context) return context.search;
  if (!searchContextCache) searchContextCache = await prepareSearchContext();
  return searchContextCache;
}

export const searchService = {
  async search(
    query: string,
    n?: number,
    lat?: number,
    lon?: number,
  ): Promise<Document[]> {
    const startTime = Date.now();

    // Get or build search context
    const { index, documents, avgDl } = await getOrBuildSearchContext();

    // Parse query into trigrams
    const queryTerms = parseQuery(query);
    const pos: GeoCoordinate | undefined =
      lat !== undefined && lon !== undefined
        ? { latitude: lat, longitude: lon }
        : undefined;

    const numResults = n ?? DEFAULT_NUM_RESULTS;
    const numDocs = Object.keys(documents).length;

    const overallScores = new Map<string, number>();

    console.log(
      `Starting search for query: ${query} (${queryTerms.length} terms) at ${Date.now() - startTime}ms`,
    );

    // For each term in the query
    for (const word of queryTerms) {
      const relDocs = index[word];
      if (!relDocs || relDocs.length === 0) {
        continue;
      }

      const docFreq = relDocs.length;

      // Score each document containing this term
      for (const [docId, termFreq] of relDocs) {
        const doc = documents[docId];
        if (!doc) continue;

        const docLen = doc.numTerms;
        const score = BM25Term(termFreq, docLen, docFreq, numDocs, avgDl);

        // Accumulate scores
        const currentScore = overallScores.get(docId) ?? 0;
        overallScores.set(docId, currentScore + score);
      }

      console.log(`Processed word '${word}' at ${Date.now() - startTime}ms`);
    }

    // Apply distance weighting for rooms if position is provided
    const scoredDocs: [string, number][] = Array.from(
      overallScores.entries(),
    ).map(([docId, score]) => {
      const doc = documents[docId];
      if (doc.type === "room") {
        return [docId, distanceWeightedScore(doc, pos, score)];
      }
      return [docId, score];
    });

    // Get top N results (sorted by score descending)
    const topResults = topN(scoredDocs, numResults, true);
    console.log(`Overall scores calculated at ${Date.now() - startTime}ms`);

    // Return the documents (without scores)
    return topResults.map(([docId, _]) => documents[docId]);
  },
};
