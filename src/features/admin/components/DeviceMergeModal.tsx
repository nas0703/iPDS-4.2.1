import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GitMerge, X, AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Radio } from 'lucide-react';

export interface MergeCandidate {
  device_id: string;
  device_name?: string;
  estate_id?: string;
  status?: string;
  operator_name?: string;
  role?: string;
  credential_present?: boolean;
  credential_version?: number | null;
  credential_rotated_at?: string | null;
  created_at?: string;
  last_seen_at?: string;
  user_agent?: string;
  ip_address?: string;
  merged_into?: string | null;
}

interface DeviceMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerged: () => void;
  estateId?: string;
  isDarkMode?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  const token =
    localStorage.getItem('ipds_token') ||
    sessionStorage.getItem('ipds_token') ||
    localStorage.getItem('fpm_auth_token') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('fpm_auth_token') ||
    '';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

export function DeviceMergeModal({ isOpen, onClose, onMerged, estateId, isDarkMode, showToast }: DeviceMergeModalProps) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<MergeCandidate[]>([]);
  const [canonicalId, setCanonicalId] = useState<string>('');
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const operationIdRef = useRef<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/merge-candidates?estateId=${encodeURIComponent(estateId || 'ALL')}`, {
        headers: authHeaders(),
        credentials: 'include'
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.devices)) {
        setDevices(json.devices.filter((d: MergeCandidate) => d.status === 'APPROVED' && !d.merged_into));
      } else {
        setError(json?.error || 'Gagal memuatkan peranti.');
      }
    } catch {
      setError('Ralat sambungan pelayan.');
    } finally {
      setLoading(false);
    }
  }, [estateId]);

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setCanonicalId('');
      setDuplicateIds([]);
      setResult(null);
      setError(null);
      operationIdRef.current = `MERGE-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const canonical = devices.find((d) => d.device_id === canonicalId) || null;
  const duplicates = devices.filter((d) => duplicateIds.includes(d.device_id));

  const toggleDuplicate = (id: string) => {
    setError(null);
    setDuplicateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const validate = (): string | null => {
    if (!canonical) return 'Sila pilih SATU peranti kanonikal.';
    if (duplicates.length === 0) return 'Sila pilih sekurang-kurangnya SATU peranti duplikat.';
    if (duplicateIds.includes(canonicalId)) return 'Peranti kanonikal tidak boleh menjadi duplikat.';
    const estate = String(canonical.estate_id || '').toUpperCase();
    if (duplicates.some((d) => String(d.estate_id || '').toUpperCase() !== estate)) return 'Gabungan merentas ladang tidak dibenarkan.';
    if (duplicates.some((d) => d.status !== 'APPROVED')) return 'Semua peranti mesti APPROVED.';
    if (duplicates.some((d) => d.merged_into)) return 'Peranti telah digabungkan sebelum ini.';
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/devices/merge', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          operationId: operationIdRef.current,
          canonicalDeviceId: canonicalId,
          duplicateDeviceIds: duplicateIds
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setResult(json);
        setStep('done');
        if (showToast) showToast('Peranti duplikat berjaya digabungkan.', 'success');
        onMerged();
      } else {
        setError(json?.error || 'Gabungan peranti gagal.');
        if (showToast) showToast(json?.error || 'Gabungan peranti gagal.', 'error');
      }
    } catch {
      setError('Ralat sambungan pelayan semasa menggabungkan peranti.');
    } finally {
      setSubmitting(false);
    }
  };

  const card = isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${card}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700/40 sticky top-0 bg-inherit z-10">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
            <GitMerge size={18} className="text-emerald-400" />
            Gabung Peranti (Merge Device)
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/40 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span><strong>Hanya gabungkan peranti yang disahkan SAMA peranti fizikal.</strong> Persamaan nama peranti, operator atau pelayar sahaja BUKAN bukti.</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-200 text-xs">{error}</div>
          )}

          {step === 'select' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">
                  Peranti APPROVED (ladang {estateId || 'TERPILIH'}) — {devices.length}
                </span>
                <button type="button" onClick={load} className="text-xs px-2.5 py-1 rounded-lg border border-slate-600 hover:bg-slate-700/40 cursor-pointer">
                  Muat Semula
                </button>
              </div>

              {loading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Memuatkan peranti…
                </div>
              ) : devices.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Tiada peranti APPROVED untuk digabungkan.</div>
              ) : (
                <div className="space-y-2">
                  {devices.map((d) => {
                    const isCanonical = canonicalId === d.device_id;
                    const isDup = duplicateIds.includes(d.device_id);
                    return (
                      <div key={d.device_id} className={`p-3 rounded-xl border text-xs ${isCanonical ? 'border-emerald-500/70 bg-emerald-500/10' : isDup ? 'border-amber-500/70 bg-amber-500/10' : 'border-slate-700/50'}`}>
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <div className="min-w-0">
                            <div className="font-bold truncate">{d.device_name || 'Peranti'}</div>
                            <div className="font-mono text-[11px] text-slate-400">{d.device_id}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {d.operator_name || '—'} · {d.role || '—'} · {d.status} · kredensial: {d.credential_present ? `ada (v${d.credential_version ?? '?'})` : 'tiada'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              dicipta {fmt(d.created_at)} · aktif {fmt(d.last_seen_at)} · {d.ip_address || '—'} · {d.user_agent || '—'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="canonical" checked={isCanonical} onChange={() => { setCanonicalId(d.device_id); setDuplicateIds((p) => p.filter((x) => x !== d.device_id)); }} />
                              <span>Kanonikal</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={isDup} disabled={isCanonical} onChange={() => toggleDuplicate(d.device_id)} />
                              <span>Duplikat</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-600 cursor-pointer">Batal</button>
                <button
                  type="button"
                  disabled={!!validate()}
                  onClick={() => setStep('confirm')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 cursor-pointer"
                >
                  Semak Gabungan
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && canonical && (
            <>
              <div className="p-4 rounded-xl border border-rose-500/50 bg-rose-500/10 text-sm">
                <div className="font-black mb-2">Gabungkan {duplicates.length} peranti ke dalam kanonikal {canonical.device_id}?</div>
                <div className="text-xs space-y-1">
                  <div><ShieldCheck size={13} className="inline text-emerald-400" /> Kanonikal: <span className="font-mono">{canonical.device_id}</span></div>
                  {duplicates.map((d) => (
                    <div key={d.device_id}><Radio size={13} className="inline text-amber-400" /> Duplikat: <span className="font-mono">{d.device_id}</span></div>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Duplikat akan ditanda <strong>REVOKED</strong> dan dihalakan ke kanonikal. Tiada rekod dipadam; kredensial dikekalkan.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" disabled={submitting} onClick={() => setStep('select')} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-600 cursor-pointer">Kembali</button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 cursor-pointer inline-flex items-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />} Sahkan & Gabung
                </button>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <>
              <div className="p-4 rounded-xl border border-emerald-500/60 bg-emerald-500/10 text-sm space-y-1">
                <div className="font-black flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Gabungan Selesai</div>
                <div className="text-xs">Kanonikal: <span className="font-mono">{result.canonicalDeviceId}</span></div>
                <div className="text-xs">Digabung: <span className="font-mono">{(result.mergedDuplicateIds || []).join(', ') || '—'}</span></div>
                {Array.isArray(result.alreadyMergedIds) && result.alreadyMergedIds.length > 0 && (
                  <div className="text-xs">Sudah digabung (idempotent): <span className="font-mono">{result.alreadyMergedIds.join(', ')}</span></div>
                )}
                <div className="text-xs">Operasi: <span className="font-mono">{result.operationId}</span></div>
                <div className="text-xs">Masa: {fmt(result.mergedAt)}</div>
                <div className="text-xs text-emerald-300 mt-1">Peranti duplikat kini REVOKED dan dihalakan ke peranti kanonikal.</div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">Tutup</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeviceMergeModal;
