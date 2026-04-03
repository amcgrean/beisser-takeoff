'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Paperclip, Upload, Trash2, Download, FileText, Image, X } from 'lucide-react';

interface FileRecord {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number | null;
  created_at: string;
  uploaded_by: number | null;
}

interface Props {
  entityType: string;
  entityId: string;
  canDelete?: boolean;
  label?: string;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.csv,.doc,.docx';

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function fileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <Image className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileManager({ entityType, entityId, canDelete = true, label = 'Files' }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
      const res = await fetch(`/api/files?${params}`);
      if (res.ok) {
        const data = await res.json() as { files: FileRecord[] };
        setFiles(data.files);
      }
    } finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadError('');
    setUploading(true);

    try {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      const contentType = CONTENT_TYPE_MAP[ext] ?? file.type ?? 'application/octet-stream';

      // Request presigned URL
      const metaRes = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          file_name: file.name,
          content_type: contentType,
          file_size: file.size,
        }),
      });

      if (!metaRes.ok) {
        const data = await metaRes.json() as { error?: string };
        setUploadError(data.error ?? 'Upload failed.');
        return;
      }

      const { upload_url } = await metaRes.json() as { upload_url: string };

      // Upload directly to R2
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });

      if (!uploadRes.ok) {
        setUploadError('Upload to storage failed. Please try again.');
        return;
      }

      await load();
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) return;
      const data = await res.json() as { url: string };
      const a = document.createElement('a');
      a.href = data.url;
      a.download = fileName;
      a.target = '_blank';
      a.click();
    } catch { /* ignore */ }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      if (res.ok) setFiles((f) => f.filter((x) => x.id !== fileId));
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          {label}
          {files.length > 0 && <span className="text-gray-500 font-normal">({files.length})</span>}
        </h3>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition disabled:opacity-50 text-gray-300"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Attach File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploadError && (
        <div className="flex items-center justify-between p-2.5 bg-red-900/40 border border-red-700 rounded text-red-300 text-xs">
          {uploadError}
          <button onClick={() => setUploadError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-gray-500 py-2">Loading…</div>
      ) : files.length === 0 ? (
        <div className="text-xs text-gray-600 py-2">No files attached.</div>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 p-2 bg-gray-800/60 rounded border border-gray-700 group">
              {fileIcon(f.content_type)}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 truncate">{f.file_name}</div>
                <div className="text-[10px] text-gray-500">
                  {formatBytes(f.file_size)}
                  {f.created_at && <span className="ml-2">{new Date(f.created_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(f.id, f.file_name)}
                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deletingId === f.id}
                    className="p-1 hover:bg-red-900/40 rounded text-gray-500 hover:text-red-400 transition disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
