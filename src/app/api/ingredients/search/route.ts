import { searchIngredientTerms } from "../../../../lib/recommendation/index.ts";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 10);
  return Response.json({
    query,
    results: searchIngredientTerms(query, Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 10),
  });
}
