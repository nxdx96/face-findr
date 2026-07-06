CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  base_url text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  scrape_status text NOT NULL DEFAULT 'idle',
  last_successful_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  product_domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text,
  ingredient_text_raw text,
  data_quality_status text NOT NULL DEFAULT 'needs_review',
  legacy_source_row_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, normalized_name, category_id)
);

CREATE TABLE IF NOT EXISTS retailer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_product_id text,
  retailer_url text NOT NULL,
  canonical_url text NOT NULL,
  image_url text,
  image_alt_text text,
  current_price_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  rating numeric(3,2),
  review_count integer,
  availability_status text NOT NULL DEFAULT 'unknown',
  retailer_category_path text,
  last_scraped_at timestamptz,
  last_seen_at timestamptz,
  raw_source_hash text,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, retailer_product_id),
  UNIQUE (retailer_id, canonical_url)
);

CREATE INDEX IF NOT EXISTS retailer_products_product_id_idx ON retailer_products(product_id);
CREATE INDEX IF NOT EXISTS retailer_products_last_seen_at_idx ON retailer_products(last_seen_at);
CREATE INDEX IF NOT EXISTS products_normalized_name_idx ON products(normalized_name);

CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  inci_name text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL UNIQUE,
  match_type text NOT NULL DEFAULT 'alias',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  raw_name text NOT NULL,
  normalized_name text NOT NULL,
  position integer NOT NULL,
  section_label text,
  is_may_contain boolean NOT NULL DEFAULT false,
  parse_confidence numeric(4,3) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, position, normalized_name)
);

CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_id_idx ON product_ingredients(ingredient_id);

CREATE TABLE IF NOT EXISTS ingredient_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  caution_level text NOT NULL DEFAULT 'preference',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredient_group_members (
  ingredient_group_id uuid NOT NULL REFERENCES ingredient_groups(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  evidence_source text NOT NULL DEFAULT 'curated',
  confidence numeric(4,3) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ingredient_group_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES retailers(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  pages_processed integer NOT NULL DEFAULT 0,
  products_created integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_failed integer NOT NULL DEFAULT 0,
  error_summary text
);

CREATE TABLE IF NOT EXISTS scrape_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id uuid NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
  retailer_url text NOT NULL,
  error_type text NOT NULL,
  error_message text NOT NULL,
  retryable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
