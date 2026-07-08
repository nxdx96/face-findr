"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyShard, validateShardConfig } = require("../../scripts/run_scrape");

test("scrape runner allows Sephora shard configuration", () => {
  assert.deepEqual(validateShardConfig("sephora", 2, 4), { shard: 2, shards: 4 });
});

test("scrape runner keeps shard assignments non-overlapping", () => {
  const urls = ["a", "b", "c", "d", "e", "f", "g", "h"];

  assert.deepEqual(applyShard(urls, 0, 4), ["a", "e"]);
  assert.deepEqual(applyShard(urls, 1, 4), ["b", "f"]);
  assert.deepEqual(applyShard(urls, 2, 4), ["c", "g"]);
  assert.deepEqual(applyShard(urls, 3, 4), ["d", "h"]);
});

test("scrape runner rejects incomplete and out-of-range shard configuration", () => {
  assert.throws(() => validateShardConfig("sephora", 0, undefined), /must be provided together/);
  assert.throws(() => validateShardConfig("sephora", 4, 4), /between 0 and --shards - 1/);
  assert.throws(() => validateShardConfig("sephora", 0, 1), /at least 2/);
});
