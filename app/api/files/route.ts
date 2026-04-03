import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getDb } from '../../../db/index';
import { getPresignedUploadUrl } from '@/lib/r2';
import { sql } from 'drizzle-orm';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

type FileRow = { id: string; entity_type: string; entity_id: string; file_name: string; content_type: string; file_size: number | null; uploaded_by: number | null; created_at: string };

// GET /api/files?entity_type=legacy_bid&entity_id=123
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entityType = req.nextUrl.searchParams.get('entity_type') ?? '';
  const entityId = req.nextUrl.searchParams.get('entity_id') ?? '';
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id are required.' }, { status: 400 });
  }

  try {
    const db = getDb();
    const files = await db.execute(
      sql`SELECT id::text, entity_type, entity_id, file_name, content_type, file_size, uploaded_by, created_at::text
          FROM bids.files
          WHERE entity_type = ${entityType} AND entity_id = ${entityId}
          ORDER BY created_at DESC`
    ) as unknown as FileRow[];
    return NextResponse.json({ files });
  } catch (err) {
    console.error('[api/files GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/files — request a presigned upload URL and create a file record
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    entity_type?: string;
    entity_id?: string;
    file_name?: string;
    content_type?: string;
    file_size?: number;
  };

  const entityType = (body.entity_type ?? '').trim();
  const entityId = (body.entity_id ?? '').trim();
  const fileName = (body.file_name ?? '').trim();
  const contentType = (body.content_type ?? 'application/octet-stream').trim();
  const fileSize = body.file_size ?? null;

  if (!entityType || !entityId || !fileName) {
    return NextResponse.json({ error: 'entity_type, entity_id, and file_name are required.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES[contentType]) {
    return NextResponse.json({ error: 'File type not allowed.' }, { status: 400 });
  }
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB).' }, { status: 400 });
  }

  try {
    const ts = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `files/${entityType}/${entityId}/${ts}_${safeFileName}`;

    const { url } = await getPresignedUploadUrl(
      `${entityType}/${entityId}`,
      `${ts}_${safeFileName}`
    );

    const db = getDb();
    const inserted = await db.execute(
      sql`INSERT INTO bids.files (entity_type, entity_id, file_name, r2_key, content_type, file_size, uploaded_by)
          VALUES (${entityType}, ${entityId}, ${fileName}, ${r2Key}, ${contentType}, ${fileSize}, ${session.user.id ?? null})
          RETURNING id::text, entity_type, entity_id, file_name, r2_key, content_type, file_size, created_at::text`
    ) as unknown as FileRow[];

    return NextResponse.json({ file: inserted[0], upload_url: url }, { status: 201 });
  } catch (err) {
    console.error('[api/files POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
