"use strict";

class RetailerAdapter {
  constructor(config = {}) {
    this.config = {
      concurrency: 1,
      delayMs: 5000,
      userAgent: "Ingredi-Findr catalog refresh (+public product metadata only)",
      ...config
    };
  }

  get slug() {
    throw new Error("Adapter must define slug.");
  }

  get displayName() {
    throw new Error("Adapter must define displayName.");
  }

  async discoverProductUrls() {
    throw new Error("Adapter must implement discoverProductUrls().");
  }

  extractProduct() {
    throw new Error("Adapter must implement extractProduct().");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { RetailerAdapter, sleep };
