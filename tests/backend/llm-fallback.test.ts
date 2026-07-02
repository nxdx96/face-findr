import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUserNeeds,
  templateInterpretation,
  validateLlmInterpretation,
} from "../../src/lib/llm/adapter.ts";

test("uses deterministic template interpretation when LLM is disabled", async () => {
  const result = await parseUserNeeds("I need shampoo and react badly to fragrance", {
    provider: "disabled",
    endpoint: "https://example.test/llm",
    model: "test-model",
    timeoutMs: 10,
  });

  assert.deepEqual(result.categories, ["shampoo"]);
  assert.deepEqual(result.avoidedIngredientGroups, [{ group: "fragrance", severity: "sensitivity" }]);
  assert.match(result.uncertaintyNotes.join(" "), /Template parser used/);
});

test("falls back when an enabled LLM returns unsupported schema values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categories: ["medicine"],
                skinConcerns: ["diagnosis"],
                preferences: [],
                avoidedIngredientGroups: [{ group: "fragrance", severity: "guarantee" }],
                uncertaintyNotes: [],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    const result = await parseUserNeeds("fragrance allergy", {
      provider: "openai-compatible",
      apiKey: "test-key",
      endpoint: "https://example.test/llm",
      model: "test-model",
      timeoutMs: 50,
    });

    assert.deepEqual(result, templateInterpretation("fragrance allergy"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects LLM output that invents unsupported product-safety fields", () => {
  const result = validateLlmInterpretation({
    categories: ["skincare"],
    skinConcerns: ["redness"],
    preferences: ["reaction-free"],
    avoidedIngredientGroups: [{ group: "fragrance", severity: "allergy" }],
    medicalGuarantee: "safe for eczema",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join("\n"), /preferences contains unsupported value/);
});
