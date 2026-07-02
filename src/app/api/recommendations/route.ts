import { loadProducts, recommendProducts, validateRecommendationRequest } from "../../../lib/recommendation/index.ts";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["request body must be valid JSON"] }, { status: 400 });
  }

  const parsed = validateRecommendationRequest(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 400 });

  const products = await loadProducts();
  const response = recommendProducts(products, parsed.value);
  return Response.json(response);
}
