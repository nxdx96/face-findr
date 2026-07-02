export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    service: "Ingredi-Findr-recommendation-backend",
    llm: process.env.FACE_FINDR_LLM_ENABLED === "true" ? "configured" : "disabled",
  });
}
