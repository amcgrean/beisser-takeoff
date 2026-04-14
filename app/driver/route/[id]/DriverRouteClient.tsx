'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, MapPin, CheckCircle2, Camera,
  AlertCircle, RefreshCw, Truck, Package, SkipForward,
} from 'lucide-react';

interface Stop {
  id: number;
  so_id: string;
  shipment_num: number;
  sequence: number;
  status: string;
  notes: string | null;
  customer_name: string | null;
  cust_code: string | null;
  address_1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  reference: string | null;
  ship_via: string | null;
  so_status: string | null;
}

interface Route {
  id: number;
  route_date: string;
  route_name: string;
  branch_code: string;
  driver_name: string | null;
  truck_id: string | null;
  status: string | null;
  notes: string | null;
}

interface Props {
  routeId: number;
  driverName: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending:   '#94a3b8',
  delivered: '#4ade80',
  skipped:   '#f59e0b',
};

export default function DriverRouteClient({ routeId, driverName }: Props) {
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState<number | null>(null); // stopId being marked
  const [skipping, setSkipping] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dispatch/routes/${routeId}/details`);
      if (!res.ok) throw new Error('Failed to load route');
      const data = await res.json();
      setRoute(data.route);
      setStops(data.stops);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load route');
    }
    setLoading(false);
  }, [routeId]);

  useEffect(() => { load(); }, [load]);

  async function updateStopStatus(stop: Stop, status: 'delivered' | 'skipped') {
    if (status === 'delivered') setDelivering(stop.id);
    else setSkipping(stop.id);
    setError('');
    try {
      const res = await fetch(`/api/dispatch/orders/${encodeURIComponent(stop.so_id)}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode:  route?.branch_code ?? '',
          shipmentNum: stop.shipment_num,
          stopId:      stop.id,
          status,
          shipDate:    new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      setStops((prev) => prev.map((s) => s.id === stop.id ? { ...s, status } : s));
      if (data.agilityWarning) console.warn('[driver] Agility warning:', data.agilityWarning);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to mark ${status}`);
    }
    if (status === 'delivered') setDelivering(null);
    else setSkipping(null);
  }

  function markDelivered(stop: Stop) { updateStopStatus(stop, 'delivered'); }

  function skipStop(stop: Stop) {
    if (!window.confirm(`Skip stop for ${stop.customer_name ?? stop.so_id}?`)) return;
    updateStopStatus(stop, 'skipped');
  }

  function openPod(stop: Stop) {
    const params = new URLSearchParams({
      branch:   route?.branch_code ?? '',
      shipment: String(stop.shipment_num),
      customer: stop.customer_name ?? '',
    });
    router.push(`/dispatch/pod/${encodeURIComponent(stop.so_id)}?${params}`);
  }

  const total     = stops.length;
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const skippedCt = stops.filter((s) => s.status === 'skipped').length;
  const done      = delivered + skippedCt;
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#475569',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!route) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 32,
                    color: '#ef4444', textAlign: 'center',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {error || 'Route not found'}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#0f172a', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => router.push('/driver')}
            style={{ background: 'none', border: 'none', color: '#94a3b8',
                     cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <ChevronLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#67e8f9',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {route.route_name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 1 }}>
              {route.branch_code}
              {route.driver_name ? ` · ${route.driver_name}` : ''}
              {route.truck_id ? ` · ${route.truck_id}` : ''}
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8', flexShrink: 0 }}>
            {done}/{total}
            {skippedCt > 0 && (
              <span style={{ fontSize: '0.6875rem', color: '#fcd34d', marginLeft: 4 }}>
                ({skippedCt} skipped)
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#0f172a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: pct === 100 ? '#22c55e' : '#0e7490',
            width: `${pct}%`, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Stops */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
                    display: 'flex', flexDirection: 'column', gap: 10 }}>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                        background: '#450a0a', border: '1px solid #7f1d1d',
                        borderRadius: 10, padding: '12px 14px', color: '#fca5a5',
                        fontSize: '0.875rem', marginBottom: 4 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        {stops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Package size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#64748b' }}>No stops on this route</div>
          </div>
        ) : stops.map((stop, idx) => {
          const delivered = stop.status === 'delivered';
          const skipped   = stop.status === 'skipped';
          const done      = delivered || skipped;
          const isDelivering = delivering === stop.id;
          const isSkipping   = skipping === stop.id;

          const cardBg     = delivered ? '#0a1f0f' : skipped ? '#1c1407' : '#1e293b';
          const cardBorder = delivered ? '#166534' : skipped ? '#78350f' : '#334155';
          const numBg      = delivered ? '#166534' : skipped ? '#78350f' : '#1e3a5f';
          const numColor   = delivered ? '#4ade80' : skipped ? '#fcd34d' : '#67e8f9';
          const nameColor  = delivered ? '#4ade80' : skipped ? '#fcd34d' : '#e2e8f0';

          return (
            <div
              key={stop.id}
              style={{
                background: cardBg, border: `1px solid ${cardBorder}`,
                borderRadius: 12, padding: '14px',
                opacity: done ? 0.75 : 1,
              }}
            >
              {/* Stop header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: numBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: numColor,
                }}>
                  {delivered ? <CheckCircle2 size={16} /> : skipped ? <SkipForward size={14} /> : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: nameColor }}>
                    {stop.customer_name ?? stop.so_id}
                  </div>
                  {(stop.address_1 || stop.city) && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2,
                                  display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} />
                      {[stop.address_1, stop.city, stop.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: 3,
                                display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>SO: {stop.so_id}</span>
                    {stop.reference && <span>Ref: {stop.reference}</span>}
                    {stop.ship_via && <span>{stop.ship_via}</span>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!done && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openPod(stop)}
                    style={{
                      flex: 1, padding: '11px 6px',
                      background: '#164e63', border: '1px solid #0e7490',
                      borderRadius: 10, color: '#67e8f9', fontSize: '0.8125rem',
                      fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Camera size={15} />
                    Photos
                  </button>
                  <button
                    onClick={() => markDelivered(stop)}
                    disabled={isDelivering || isSkipping}
                    style={{
                      flex: 1.4, padding: '11px 6px',
                      background: isDelivering ? '#1e293b' : '#14532d',
                      border: `1px solid ${isDelivering ? '#334155' : '#166534'}`,
                      borderRadius: 10, color: isDelivering ? '#64748b' : '#4ade80',
                      fontSize: '0.8125rem', fontWeight: 600,
                      cursor: (isDelivering || isSkipping) ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <CheckCircle2 size={15} />
                    {isDelivering ? 'Saving…' : 'Delivered'}
                  </button>
                  <button
                    onClick={() => skipStop(stop)}
                    disabled={isDelivering || isSkipping}
                    style={{
                      padding: '11px 10px',
                      background: isSkipping ? '#1e293b' : '#1c1407',
                      border: `1px solid ${isSkipping ? '#334155' : '#78350f'}`,
                      borderRadius: 10, color: isSkipping ? '#64748b' : '#fcd34d',
                      fontSize: '0.8125rem', fontWeight: 600,
                      cursor: (isDelivering || isSkipping) ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    {isSkipping ? '…' : <SkipForward size={15} />}
                  </button>
                </div>
              )}

              {delivered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                              color: '#4ade80', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  Delivered
                  <button
                    onClick={() => openPod(stop)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none',
                             color: '#475569', cursor: 'pointer', fontSize: '0.75rem',
                             display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                  >
                    <Camera size={13} /> View Photos
                  </button>
                </div>
              )}

              {skipped && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                              color: '#fcd34d', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <SkipForward size={16} />
                  Skipped
                </div>
              )}
            </div>
          );
        })}

        {/* All done banner */}
        {total > 0 && done === total && (
          <div style={{
            background: skippedCt > 0 ? '#1c1407' : '#14532d',
            border: `1px solid ${skippedCt > 0 ? '#78350f' : '#166534'}`,
            borderRadius: 12, padding: '20px', textAlign: 'center', marginTop: 8,
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{skippedCt > 0 ? '⚠️' : '🎉'}</div>
            <div style={{ fontWeight: 700, color: skippedCt > 0 ? '#fcd34d' : '#4ade80', fontSize: '1rem' }}>
              Route complete{skippedCt > 0 ? ' with skips' : '!'}
            </div>
            <div style={{ color: skippedCt > 0 ? '#fde68a' : '#86efac', fontSize: '0.8125rem', marginTop: 4 }}>
              {delivered} delivered{skippedCt > 0 ? `, ${skippedCt} skipped` : ''} — {route.route_name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
