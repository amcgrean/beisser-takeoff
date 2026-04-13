'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, MapPin, ChevronRight, RefreshCw, Package } from 'lucide-react';

interface Route {
  id: number;
  route_date: string;
  route_name: string;
  branch_code: string;
  driver_name: string | null;
  truck_id: string | null;
  status: string | null;
  stop_count: number;
}

interface Props {
  driverName: string;
  branch: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function DriverHomeClient({ driverName, branch }: Props) {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today());

  async function loadRoutes() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (branch) params.set('branch', branch);
      const res = await fetch(`/api/dispatch/routes?${params}`);
      if (res.ok) {
        const data: Route[] = await res.json();
        setRoutes(data);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }

  useEffect(() => { loadRoutes(); }, [date]);

  const myRoutes = routes.filter((r) =>
    !r.driver_name || r.driver_name.toLowerCase().includes(driverName.toLowerCase()) || driverName === ''
  );

  return (
    <div style={{
      minHeight: '100dvh', background: '#0f172a', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '16px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#164e63', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Truck size={18} color="#67e8f9" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              {driverName || 'Driver'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              LiveEdge Delivery
            </div>
          </div>
          <button
            onClick={loadRoutes}
            style={{ marginLeft: 'auto', background: 'none', border: 'none',
                     color: '#475569', cursor: 'pointer', padding: 6, display: 'flex' }}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #334155',
            borderRadius: 8, color: '#e2e8f0', padding: '10px 12px',
            fontSize: '0.9375rem', outline: 'none',
          }}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            Loading routes…
          </div>
        ) : routes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Package size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#64748b', fontWeight: 600 }}>No routes for this date</div>
            <div style={{ color: '#475569', fontSize: '0.8125rem', marginTop: 6 }}>
              Check with your dispatcher or try another date.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 4 }}>
              {routes.length} route{routes.length !== 1 ? 's' : ''} — tap to open
            </div>
            {routes.map((r) => {
              const isMe = !r.driver_name ||
                r.driver_name.toLowerCase().includes(driverName.toLowerCase());
              const delivered = r.status === 'complete';
              return (
                <button
                  key={r.id}
                  onClick={() => router.push(`/driver/route/${r.id}`)}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: delivered ? '#0f2a1a' : '#1e293b',
                    border: `1px solid ${isMe ? '#0e7490' : '#334155'}`,
                    borderRadius: 12, padding: '16px',
                    cursor: 'pointer', color: '#e2e8f0',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: isMe ? '#164e63' : '#0f172a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Truck size={22} color={isMe ? '#67e8f9' : '#475569'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: isMe ? '#67e8f9' : '#cbd5e1' }}>
                      {r.route_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 3,
                                  display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {r.driver_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Truck size={11} /> {r.driver_name}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <MapPin size={11} /> {r.branch_code}
                      </span>
                      <span>{r.stop_count} stop{r.stop_count !== 1 ? 's' : ''}</span>
                      {delivered && <span style={{ color: '#4ade80' }}>✓ Complete</span>}
                    </div>
                  </div>
                  <ChevronRight size={18} color="#475569" style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
