import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getDb } from '../../../../../db/index';
import { legacyBidFile } from '../../../../../db/schema-legacy';
import { eq } from 'drizzle-orm';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type RouteContext = { params: Promise<{ id: string }> };

function getR2(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 not configured');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  return process.env.R2_BUCKET_NAME || 'bids';
}

function dbError(err: unknown) {
  console.error('[bid files API]', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// ──────────────────────────────────────────────────────────
// GET /api/legacy-bids/:id/files?action=presign&fileName=...
// Returns a presigned R2 upload URL + storage key
// ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const bidId = parseInt(id, 10);
  if (isNaN(bidId)) return NextResponse.json({ error: 'Invalid bid ID' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const fileName = searchParams.get('fileName')?.trim();

  // List files
  if (action !== 'presign') {
    try {
      const db = getDb();
      const files = await db
        .select()
        .from(legacyBidFile)
        .where(eq(legacyBidFile.bidId, bidId));
      return NextResponse.json({ files });
    } catch (err) {
      return dbError(err);
    }
  }

  // Presigned upload URL
  if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 422 });

  try {
    const r2 = getR2();
    const year = new Date().getFullYear();
    const key = `bids/${year}/${bidId}/${Date.now()}_${fileName}`;
    const url = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: getBucket(), Key: key }),
      { expiresIn: 600 }
    );
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error('[bid files presign]', err);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────
// POST /api/legacy-bids/:id/files
// Confirm an upload (after presigned PUT) or proxy small files
// Body: { fileName, fileKey, fileType } OR multipart FormData
// ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const bidId = parseInt(id, 10);
  if (isNaN(bidId)) return NextResponse.json({ error: 'Invalid bid ID' }, { status: 400 });

  const contentType = req.headers.get('content-type') ?? '';

  try {
    const db = getDb();

    if (contentType.includes('application/json')) {
      // Confirm presigned upload
      const body = await req.json() as { fileName: string; fileKey: string; fileType?: string };
      if (!body.fileName || !body.fileKey) {
        return NextResponse.json({ error: 'fileName and fileKey required' }, { status: 422 });
      }
      const [file] = await db.insert(legacyBidFile).values({
        bidId,
        filename: body.fileName,
        fileKey: body.fileKey,
        fileType: body.fileType ?? null,
      }).returning();
      return NextResponse.json({ file }, { status: 201 });
    }

    // Proxy small file upload (multipart/form-data)
    const form = await req.formData();
    const fileEntry = form.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json({ error: 'No file in request' }, { status: 422 });
    }

    const r2 = getR2();
    const year = new Date().getFullYear();
    const key = `bids/${year}/${bidId}/${Date.now()}_${fileEntry.name}`;
    const buf = Buffer.from(await fileEntry.arrayBuffer());

    await r2.send(new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buf,
      ContentType: fileEntry.type || 'application/octet-stream',
    }));

    const [file] = await db.insert(legacyBidFile).values({
      bidId,
      filename: fileEntry.name,
      fileKey: key,
      fileType: fileEntry.type || null,
    }).returning();

    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    return dbError(err);
  }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/legacy-bids/:id/files?fileId=123
// ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const bidId = parseInt(id, 10);
  if (isNaN(bidId)) return NextResponse.json({ error: 'Invalid bid ID' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const fileId = parseInt(searchParams.get('fileId') ?? '', 10);
  if (isNaN(fileId)) return NextResponse.json({ error: 'fileId required' }, { status: 422 });

  try {
    const db = getDb();
    const [file] = await db
      .select()
      .from(legacyBidFile)
      .where(eq(legacyBidFile.id, fileId))
      .limit(1);

    if (!file || file.bidId !== bidId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete from R2
    try {
      const r2 = getR2();
      await r2.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: file.fileKey }));
    } catch {
      // Don't fail if R2 delete fails — still remove DB record
    }

    await db.delete(legacyBidFile).where(eq(legacyBidFile.id, fileId));
    return NextResponse.json({ success: true });
  } catch (err) {
    return dbError(err);
  }
}
