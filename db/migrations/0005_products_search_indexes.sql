-- Full-text search GIN index on agility_items.
-- Columns included depend on what exists in the table; primary_supplier and
-- default_location are optional and only added when present.
DO $$
DECLARE
  has_primary_supplier boolean;
  has_default_location boolean;
  fts_expr text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agility_items'
      AND column_name = 'primary_supplier'
  ) INTO has_primary_supplier;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agility_items'
      AND column_name = 'default_location'
  ) INTO has_default_location;

  fts_expr :=
    $s$ coalesce(item, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(ext_description, '') || ' ' ||
        coalesce(short_des, '') || ' ' ||
        coalesce(size_, '') || ' ' ||
        coalesce(type, '') || ' ' ||
        coalesce(stocking_uom, '') || ' ' ||
        coalesce(handling_code, '') $s$;

  IF has_default_location THEN
    fts_expr := fts_expr || $s$ || ' ' || coalesce(default_location, '') $s$;
  END IF;

  IF has_primary_supplier THEN
    fts_expr := fts_expr || $s$ || ' ' || coalesce(primary_supplier, '') $s$;
  END IF;

  EXECUTE format(
    $sql$
      CREATE INDEX IF NOT EXISTS idx_agility_items_fts
        ON public.agility_items
        USING GIN (to_tsvector('english', %s))
        WHERE is_deleted = false
    $sql$,
    fts_expr
  );
END $$;

-- Composite index for product-group tile queries and browse filtering.
-- Covers: branch filter (system_id), GROUP BY major, filter by minor.
-- Used by: GET /api/sales/products/groups, /majors, and item browse.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agility_items'
      AND column_name = 'product_major_code'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_agility_items_group_browse
        ON public.agility_items (system_id, product_major_code, product_minor_code)
        WHERE is_deleted = false
          AND active_flag = true
          AND stock = true
          AND product_major_code IS NOT NULL
    $sql$;
  END IF;
END $$;
