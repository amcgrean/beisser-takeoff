-- Full-text search GIN index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agility_items'
      AND column_name = 'primary_supplier'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_agility_items_fts
        ON public.agility_items
        USING GIN (
          to_tsvector('english',
            coalesce(item, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(ext_description, '') || ' ' ||
            coalesce(short_des, '') || ' ' ||
            coalesce(size_, '') || ' ' ||
            coalesce(type, '') || ' ' ||
            coalesce(stocking_uom, '') || ' ' ||
            coalesce(handling_code, '') || ' ' ||
            coalesce(default_location, '') || ' ' ||
            coalesce(primary_supplier, '')
          )
        )
        WHERE is_deleted = false
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS idx_agility_items_fts
        ON public.agility_items
        USING GIN (
          to_tsvector('english',
            coalesce(item, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(ext_description, '') || ' ' ||
            coalesce(size_, '') || ' ' ||
            coalesce(type, '') || ' ' ||
            coalesce(stocking_uom, '') || ' ' ||
            coalesce(handling_code, '') || ' ' ||
            coalesce(default_location, '')
          )
        )
        WHERE is_deleted = false
    $sql$;
  END IF;
END $$;

-- Composite index for product-group tile queries and browse filtering.
-- Covers: branch filter (system_id), GROUP BY major, filter by minor.
-- Used by: GET /api/sales/products/groups, /majors, and item browse.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agility_items'
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
