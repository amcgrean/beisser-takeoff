import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { getDb, schema } from '../../../../../../db/index';
import { legacyBidFile } from '../../../../../../db/schema-legacy';
import { eq, desc } from 'drizzle-orm';
import { getPresignedPdfUrl, downloadPdf } from '@/lib/r2';

function dbError(err: unknown) {
  if (err instanceof Error && err.message.includes('DATABASE_URL')) {
    return NextResponse.json(
      { error: 'Database not configured. Please set DATABASE_URL.' },
      { status: 503 }
    );
  }
  console.error('[takeoff/sessions/[sessionId]/pdf API]', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * If a session has no pdfStorageKey but is linked to a legacy bid, try to find
 * the most recent PDF attached to that bid in legacyBidFile. This recovers
 * sessions whose uploads failed silently (e.g., pre-CORS-fix sessions where the
 * direct-to-R2 PUT was blocked and the confirm-PUT never ran), and handles
 * sessions predating the auto-linking logic in start-takeoff.
 *
 * When a fallback is found, we also update the session row so subsequent loads
 * don't need to re-scan legacyBidFile.
 */
async function resolvePdfStorageKey(
  session: typeof schema.takeoffSessions.$inferSelect
): Promise<{ storageKey: string; fileName: string } | null> {
  if (session.pdfStorageKey) {
    return {
      storageKey: session.pdfStorageKey,
      fileName: session.pdfFileName || 'plan.pdf',
    };
  }

  if (!session.legacyBidId) return null;

  const db = getDb();
  const files = await db
    .select()
    .from(legacyBidFile)
    .where(eq(legacyBidFile.bidId, session.legacyBidId))
    .orderBy(desc(legacyBidFile.uploadedAt));

  const pdf = files.find(
    (f) =>
      f.fileType?.includes('pdf') ||
      f.filename.toLowerCase().endsWith('.pdf')
  );
  if (!pdf) return null;

  // Auto-link the found PDF back to the session so this fallback only runs once.
  await db
    .update(schema.takeoffSessions)
    .set({
      pdfStorageKey: pdf.fileKey,
      pdfFileName: pdf.filename,
      updatedAt: new Date(),
    })
    .where(eq(schema.takeoffSessions.id, session.id));

  return { storageKey: pdf.fileKey, fileName: pdf.filename };
}

// ──────────────────────────────────────────────────────────
// GET /api/takeoff/sessions/[sessionId]/pdf  – get PDF (presigned URL or direct)
// ──────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authSession = await auth();
  if (!authSession)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'url'; // 'url' or 'download'

  try {
    const db = getDb();
    const [session] = await db
      .select()
      .from(schema.takeoffSessions)
      .where(eq(schema.takeoffSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const resolved = await resolvePdfStorageKey(session);
    if (!resolved) {
      return NextResponse.json({ error: 'No PDF uploaded for this session' }, { status: 404 });
    }

    if (mode === 'download') {
      // Stream the PDF directly from R2 through this serverless function.
      // Kept as a fallback, but clients should prefer mode=url (presigned
      // direct-to-R2 GET) to avoid Vercel function memory pressure on large PDFs.
      const buffer = await downloadPdf(resolved.storageKey);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${resolved.fileName}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Default: return presigned URL so the browser fetches directly from R2.
    const url = await getPresignedPdfUrl(resolved.storageKey);
    return NextResponse.json({ url, fileName: resolved.fileName });
  } catch (err) {
    return dbError(err);
  }
}
