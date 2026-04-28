import { getErpSql } from '../../../../db/supabase';

export type ErpSql = ReturnType<typeof getErpSql>;

type ColumnRow = {
  column_name: string;
};

const BASE_SEARCH_COLUMNS = [
  'item',
  'description',
  'ext_description',
  'short_des',
  'size_',
  'type',
  'stocking_uom',
  'handling_code',
  // default_location omitted — column name varies across agility_items versions;
  // included dynamically below if present
] as const;

let columnCache: Set<string> | null = null;

export async function getAgilityItemColumns(sql: ErpSql): Promise<Set<string>> {
  if (columnCache) return columnCache;
  const rows = (await sql.unsafe(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'agility_items'`
  )) as ColumnRow[];
  columnCache = new Set(rows.map((r) => r.column_name));
  return columnCache;
}

export function hasPrimarySupplierColumn(columns: Set<string>): boolean {
  return columns.has('primary_supplier');
}

export function parseIncludeInactive(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export function isProductAdmin(user: { role?: string | null; roles?: string[] | null }): boolean {
  return (
    user.role === 'admin' ||
    (user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops', 'sales'].includes(r))
  );
}

export function addParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

/** Filters for agility_items browse (stock + active + branch). */
export function appendItemFilters(
  where: string[],
  params: unknown[],
  branch: string,
  includeInactive: boolean,
) {
  where.push('is_deleted = false');
  if (!includeInactive) {
    where.push('active_flag = true');
    where.push('stock = true');
  }
  if (branch) {
    where.push(`item_branch = ${addParam(params, branch)}`);
  }
}

export function getSearchColumns(columns: Set<string>): string[] {
  const cols = BASE_SEARCH_COLUMNS.filter((c) => columns.has(c)) as string[];
  if (columns.has('default_location')) cols.push('default_location');
  if (columns.has('primary_supplier')) cols.push('primary_supplier');
  return cols;
}

export function buildSearchVector(columns: Set<string>): string {
  return `to_tsvector('english', ${getSearchColumns(columns)
    .map((c) => `coalesce(${c}, '')`)
    .join(` || ' ' || `)})`;
}

export function buildIlikeClause(columns: Set<string>, placeholder: string): string {
  return `(${getSearchColumns(columns)
    .map((c) => `${c} ILIKE ${placeholder}`)
    .join(' OR ')})`;
}

export function formatProductLabel(code: string): string {
  const cleaned = code.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return code;
  return cleaned
    .split(' ')
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

export function buildItemSelect(columns: Set<string>): string {
  return `SELECT
    item AS item_number,
    description,
    short_des AS short_description,
    ext_description AS extended_description,
    size_ AS size,
    type,
    stocking_uom,
    handling_code,
    qty_on_hand::float8 AS qty_on_hand,
    ${columns.has('default_location') ? 'default_location' : 'NULL::text'} AS default_location,
    ${columns.has('primary_supplier') ? 'primary_supplier' : 'NULL::text'} AS primary_supplier,
    item_branch AS system_id,
    active_flag,
    stock`;
}
