import express from 'express';
import { getScopedSupabase, isMissingTableError } from '../db.js';
import { getLocalMerumputProgress, saveLocalMerumputProgress, getLocalMerumputInventory, saveLocalMerumputInventory, getLocalMerumputTransactions, saveLocalMerumputTransactions } from '../local.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getErrorMessage, getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface MerumputProgressRecord {
  id?: string;
  blok?: string;
  luas?: number;
  pusingan?: number;
  jenis?: string;
  tarikh_mula?: string | null;
  tarikh_siap?: string | null;
  hek_siap?: number;
  workers_count?: number;
  created_at?: string;
  updated_at?: string;
  estate_id?: string;
  [key: string]: unknown;
}

export interface MerumputInventoryRecord {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  type?: string;
  min_threshold?: number;
  created_at?: string;
  updated_at?: string;
  estate_id?: string;
  [key: string]: unknown;
}

export interface MerumputTransactionRecord {
  id: string;
  inventory_id: string;
  type: string;
  quantity: number;
  reference?: string;
  created_at?: string;
  estate_id?: string;
  [key: string]: unknown;
}

// --- MERUMPUT MODULE ENDPOINTS ---

router.get("/merumput/progress", requireAuth, async (req, res) => {
  try {
    const targetEstateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      const localData = getLocalMerumputProgress() as MerumputProgressRecord[];
      const filtered = localData.filter((item: MerumputProgressRecord) => {
        if (targetEstateId === 'ALL') return true;
        if (targetEstateId === 'FPM_TUNGGAL') return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
        return item.estate_id === targetEstateId;
      });
      return res.json(filtered);
    }

    let query = supabase.from('merumput_progress').select('*');
    if (targetEstateId === 'ALL') {
      // Authorized cross-estate role: no estate filter
    } else if (targetEstateId === 'FPM_TUNGGAL') {
      query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
    } else {
      query = query.eq('estate_id', targetEstateId);
    }

    const { data, error } = await query.order('blok', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        const localData = getLocalMerumputProgress(targetEstateId) as MerumputProgressRecord[];
        const filtered = localData.filter((item: MerumputProgressRecord) => {
          if (targetEstateId === 'ALL') return true;
          if (targetEstateId === 'FPM_TUNGGAL') return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
          return item.estate_id === targetEstateId;
        });
        return res.json(filtered);
      }
      throw error;
    }

    if (!data || data.length === 0) {
      const localData = getLocalMerumputProgress(targetEstateId) as MerumputProgressRecord[];
      const estateItems = localData.filter((item: MerumputProgressRecord) => {
        if (targetEstateId === 'ALL') return true;
        if (targetEstateId === 'FPM_TUNGGAL') return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
        return item.estate_id === targetEstateId;
      });

      if (estateItems.length > 0) {
        const allowedKeys = ['id', 'blok', 'luas', 'pusingan', 'jenis', 'tarikh_mula', 'tarikh_siap', 'hek_siap', 'workers_count', 'created_at', 'updated_at'];
        const processed = estateItems.map((item: MerumputProgressRecord) => {
          const record: Record<string, unknown> = {};
          allowedKeys.forEach(k => {
            if (item[k] !== undefined) record[k] = item[k];
          });
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(record.id));
          if (record.id && !isUUID) {
            delete record.id;
          }
          if (!record.tarikh_mula) record.tarikh_mula = "2026-05-01";
          record.estate_id = targetEstateId;
          return record;
        });

        try {
          const { data: seededData, error: seedError } = await supabase
            .from('merumput_progress')
            .upsert(processed, { onConflict: 'blok,pusingan,jenis' })
            .select()
            .order('blok', { ascending: true });

          if (!seedError && seededData && seededData.length > 0) {
            return res.json(seededData);
          }
        } catch (e) {
          // ignore upsert errors and fall back to local items
        }

        return res.json(estateItems);
      }
    }

    res.json(data || []);
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase fetch merumput progress failed:", getErrorMessage(err));
    }
    res.json([]);
  }
});

router.post("/merumput/progress/batch", requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const { data } = req.body;
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    saveLocalMerumputProgress(data);

    if (!supabase) {
      return res.json({ success: true, count: data.length });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('merumput_progress')
      .select('id, blok, pusingan, jenis');

    if (fetchError) {
      if (isMissingTableError(fetchError)) {
        return res.json({ success: true, count: data.length });
      }
      throw fetchError;
    }

    const allowedKeys = ['id', 'blok', 'luas', 'pusingan', 'jenis', 'tarikh_mula', 'tarikh_siap', 'hek_siap', 'workers_count', 'created_at', 'updated_at'];
    const processedData = (data as MerumputProgressRecord[]).map((item: MerumputProgressRecord) => {
      const match = existing?.find((e: { id?: string; blok?: string; pusingan?: number; jenis?: string }) =>
        String(e.blok) === String(item.blok) &&
        Number(e.pusingan) === Number(item.pusingan) &&
        String(e.jenis).trim().toUpperCase() === String(item.jenis).trim().toUpperCase()
      );

      const record: Record<string, unknown> = {};
      allowedKeys.forEach(k => {
        if (item[k] !== undefined) {
          record[k] = item[k];
        }
      });

      if (match) {
        record.id = match.id;
      } else if (!record.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(record.id))) {
        delete record.id;
      }

      if (!record.tarikh_mula || record.tarikh_mula === "") {
        record.tarikh_mula = "2026-05-01";
      }
      if (!record.tarikh_siap || record.tarikh_siap === "") {
        record.tarikh_siap = null;
      }

      record.estate_id = req.estateId || 'FPM_TUNGGAL';
      return record;
    });

    const { error } = await supabase
      .from('merumput_progress')
      .upsert(processedData, { onConflict: 'blok,pusingan,jenis' });

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ success: true, count: data.length });
      }
      throw error;
    }
    res.json({ success: true, count: data.length });
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase batch progress merumput failed, fallback to local cache:", getErrorMessage(err));
    }
    res.json({ success: true, count: req.body?.data?.length || 0 });
  }
});

router.post("/merumput/progress", requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const payload = req.body as MerumputProgressRecord;
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    const isEdit = !!payload.id && !String(payload.id).startsWith('loc-temp');

    const local = getLocalMerumputProgress() as MerumputProgressRecord[];
    const existingIdx = local.findIndex((p: MerumputProgressRecord) =>
      p.blok === payload.blok &&
      Number(p.pusingan) === Number(payload.pusingan) &&
      p.jenis === payload.jenis
    );
    const existingRec = existingIdx !== -1 ? local[existingIdx] : null;

    let finalPayload: MerumputProgressRecord = { ...payload };
    if (existingRec && !isEdit) {
      const existingHek = Number(existingRec.hek_siap || 0);
      const existingWorkers = Number(existingRec.workers_count || 0);
      const targetLuas = Number(payload.luas || existingRec.luas || 0);

      finalPayload.hek_siap = Math.min(targetLuas, existingHek + Number(payload.hek_siap || 0));
      finalPayload.workers_count = existingWorkers + Number(payload.workers_count || 0);

      if (finalPayload.hek_siap >= targetLuas * 0.999) {
        finalPayload.tarikh_siap = payload.tarikh_mula || new Date().toISOString().split('T')[0];
      } else {
        finalPayload.tarikh_siap = null;
      }

      if (existingHek > 0 && existingRec.tarikh_mula && existingRec.tarikh_mula !== "2026-05-01") {
        finalPayload.tarikh_mula = existingRec.tarikh_mula;
      }
    }

    const recordLoc: MerumputProgressRecord = {
      ...existingRec,
      ...finalPayload,
      id: existingRec?.id || payload.id || `loc-${Date.now()}`,
      created_at: existingRec?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      local[existingIdx] = recordLoc;
    } else {
      local.push(recordLoc);
    }
    saveLocalMerumputProgress(local);

    if (!supabase) {
      return res.json({ success: true, data: recordLoc });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('merumput_progress')
      .select('*')
      .eq('blok', String(payload.blok))
      .eq('pusingan', Number(payload.pusingan))
      .eq('jenis', String(payload.jenis))
      .maybeSingle();

    if (fetchError && !isMissingTableError(fetchError)) {
      throw fetchError;
    }

    const allowedKeys = ['id', 'blok', 'luas', 'pusingan', 'jenis', 'tarikh_mula', 'tarikh_siap', 'hek_siap', 'workers_count', 'created_at', 'updated_at'];
    const record: Record<string, unknown> = {};

    allowedKeys.forEach(k => {
      if (recordLoc[k] !== undefined) {
        record[k] = recordLoc[k];
      }
    });

    if (existing) {
      record.id = existing.id;
    } else {
      delete record.id;
    }

    if (!record.tarikh_mula || record.tarikh_mula === "") {
      record.tarikh_mula = "2026-05-01";
    }
    if (!record.tarikh_siap || record.tarikh_siap === "") {
      record.tarikh_siap = null;
    }

    record.estate_id = req.estateId || 'FPM_TUNGGAL';

    const { data, error } = await supabase
      .from('merumput_progress')
      .upsert([record], { onConflict: 'blok,pusingan,jenis' })
      .select();

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ success: true, data: recordLoc });
      }
      throw error;
    }
    res.json({ success: true, data: data[0] });
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase upsert progress merumput failed, fallback to local:", getErrorMessage(err));
    }
    const local = getLocalMerumputProgress() as MerumputProgressRecord[];
    const match = local.find((p: MerumputProgressRecord) => p.blok === req.body.blok && Number(p.pusingan) === Number(req.body.pusingan) && p.jenis === req.body.jenis);
    res.json({ success: true, data: match || req.body });
  }
});

// --- MERUMPUT INVENTORY ROUTES ---

router.get("/merumput/inventory", requireAuth, async (req, res) => {
  try {
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const filterLocal = (rows: MerumputInventoryRecord[]) => estateId === 'ALL' ? rows : rows.filter((i: MerumputInventoryRecord) => !i.estate_id || i.estate_id === estateId);
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.json(filterLocal(getLocalMerumputInventory() as MerumputInventoryRecord[]));
    }

    let invQuery = supabase
      .from('merumput_inventory')
      .select('*');
    if (estateId !== 'ALL') {
      invQuery = invQuery.eq('estate_id', estateId);
    }
    const { data, error } = await invQuery.order('name', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        return res.json(filterLocal(getLocalMerumputInventory() as MerumputInventoryRecord[]));
      }
      throw error;
    }
    res.json(data);
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase fetch merumput inventory failed, using local:", getErrorMessage(err));
    }
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const local = getLocalMerumputInventory() as MerumputInventoryRecord[];
    res.json(estateId === 'ALL' ? local : local.filter((i: MerumputInventoryRecord) => !i.estate_id || i.estate_id === estateId));
  }
});

router.post("/merumput/inventory", requireRole(['pf', 'fc']), async (req, res) => {
  try {
    const item = req.body as Partial<MerumputInventoryRecord>;
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      const local = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const itemName = String(item.name || '').toLowerCase();
      const existingIdx = local.findIndex((p: MerumputInventoryRecord) => p.name.toLowerCase() === itemName);
      const record: MerumputInventoryRecord = {
        id: item.id || `inv-${Date.now()}`,
        name: item.name || 'Bahan',
        quantity: parseFloat(String(item.quantity || 0)) || 0,
        min_threshold: parseFloat(String(item.min_threshold || 10)) || 10,
        unit: item.unit || 'LITER',
        type: item.type || 'RACUN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        local[existingIdx] = { ...local[existingIdx], ...record };
      } else {
        local.push(record);
        const transactions = getLocalMerumputTransactions() as MerumputTransactionRecord[];
        transactions.unshift({
          id: `tx-${Date.now()}`,
          inventory_id: record.id,
          type: 'IN',
          quantity: record.quantity,
          reference: 'Stok Awal (Sistem Fallback)',
          created_at: new Date().toISOString()
        });
        saveLocalMerumputTransactions(transactions);
      }
      saveLocalMerumputInventory(local);
      return res.json({ success: true, data: record });
    }

    const enrichedItem = {
      ...item,
      estate_id: req.estateId || 'FPM_TUNGGAL'
    };

    const { data, error } = await supabase
      .from('merumput_inventory')
      .insert([enrichedItem])
      .select();

    if (error) {
      if (isMissingTableError(error)) {
        const local = getLocalMerumputInventory() as MerumputInventoryRecord[];
        const itemName = String(item.name || '').toLowerCase();
        const existingIdx = local.findIndex((p: MerumputInventoryRecord) => p.name.toLowerCase() === itemName);
        const record: MerumputInventoryRecord = {
          id: item.id || `inv-${Date.now()}`,
          name: item.name || 'Bahan',
          quantity: parseFloat(String(item.quantity || 0)) || 0,
          min_threshold: parseFloat(String(item.min_threshold || 10)) || 10,
          unit: item.unit || 'LITER',
          type: item.type || 'RACUN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          local[existingIdx] = { ...local[existingIdx], ...record };
        } else {
          local.push(record);
        }
        saveLocalMerumputInventory(local);
        return res.json({ success: true, data: record });
      }
      throw error;
    }

    if (data && data[0] && parseFloat(String(item.quantity || 0)) > 0) {
      await supabase
        .from('merumput_inventory_transactions')
        .insert([{
          inventory_id: data[0].id,
          type: 'IN',
          quantity: parseFloat(String(item.quantity)),
          reference: 'Stok Awal',
          created_at: new Date().toISOString(),
          estate_id: req.estateId || 'FPM_TUNGGAL'
        }]);
    }

    res.json({ success: true, data: data[0] });
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase create merumput item failed, using local:", getErrorMessage(err));
    }
    try {
      const item = req.body as Partial<MerumputInventoryRecord>;
      const local = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const itemName = String(item.name || '').toLowerCase();
      const existingIdx = local.findIndex((p: MerumputInventoryRecord) => p.name.toLowerCase() === itemName);
      const record: MerumputInventoryRecord = {
        id: item.id || `inv-${Date.now()}`,
        name: item.name || 'Bahan',
        quantity: parseFloat(String(item.quantity || 0)) || 0,
        min_threshold: parseFloat(String(item.min_threshold || 10)) || 10,
        unit: item.unit || 'LITER',
        type: item.type || 'RACUN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        local[existingIdx] = { ...local[existingIdx], ...record };
      } else {
        local.push(record);
      }
      saveLocalMerumputInventory(local);
      res.json({ success: true, data: record });
    } catch (e: unknown) {
      res.status(500).json({ error: getSafeErrorMessage(e, 'Ralat memproses data merumput.') });
    }
  }
});

router.get("/merumput/inventory/transactions", requireAuth, async (req, res) => {
  try {
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const filterLocal = (rows: MerumputTransactionRecord[]) => estateId === 'ALL' ? rows : rows.filter((t: MerumputTransactionRecord) => !t.estate_id || t.estate_id === estateId);
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.json(filterLocal(getLocalMerumputTransactions() as MerumputTransactionRecord[]));
    }

    let txQuery = supabase
      .from('merumput_inventory_transactions')
      .select('*');
    if (estateId !== 'ALL') {
      txQuery = txQuery.eq('estate_id', estateId);
    }
    const { data, error } = await txQuery.order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return res.json(filterLocal(getLocalMerumputTransactions() as MerumputTransactionRecord[]));
      }
      throw error;
    }
    res.json(data);
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase fetch merumput transactions failed:", getErrorMessage(err));
    }
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const local = getLocalMerumputTransactions() as MerumputTransactionRecord[];
    res.json(estateId === 'ALL' ? local : local.filter((t: MerumputTransactionRecord) => !t.estate_id || t.estate_id === estateId));
  }
});

router.post("/merumput/inventory/:id/transaction", requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    if (!supabase) {
      const localInv = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const invItem = localInv.find((p: MerumputInventoryRecord) => p.id === id);
      if (!invItem) return res.status(404).json({ error: "Chemical not found" });

      const tx: MerumputTransactionRecord = {
        id: `tx-${Date.now()}`,
        inventory_id: id,
        type: payload.type,
        quantity: parseFloat(payload.quantity),
        reference: payload.reference || 'Manual Transaction (Fallback)',
        created_at: new Date().toISOString()
      };

      const transactions = getLocalMerumputTransactions() as MerumputTransactionRecord[];
      transactions.unshift(tx);
      saveLocalMerumputTransactions(transactions);

      const qty = parseFloat(payload.quantity);
      if (payload.type === 'IN') {
        invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) + qty;
      } else {
        invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) - qty;
      }
      invItem.updated_at = new Date().toISOString();
      saveLocalMerumputInventory(localInv);

      return res.json({ success: true, transaction: tx, newQuantity: invItem.quantity });
    }

    const { data: txData, error: txError } = await supabase
      .from('merumput_inventory_transactions')
      .insert([{
        inventory_id: id,
        type: payload.type,
        quantity: parseFloat(payload.quantity),
        reference: payload.reference,
        created_at: new Date().toISOString(),
        estate_id: req.estateId || 'FPM_TUNGGAL'
      }])
      .select();

    if (txError) throw txError;

    const { data: invItem, error: invError } = await supabase
      .from('merumput_inventory')
      .select('quantity')
      .eq('id', id)
      .single();

    if (invError) throw invError;

    const diff = parseFloat(payload.quantity);
    const newQty = payload.type === 'IN'
      ? (parseFloat(invItem.quantity) || 0) + diff
      : (parseFloat(invItem.quantity) || 0) - diff;

    await supabase
      .from('merumput_inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ success: true, transaction: txData[0], newQuantity: newQty });
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase transaction failed, fallback to local:", getErrorMessage(err));
    }
    try {
      const { id } = req.params;
      const payload = req.body;
      const localInv = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const invItem = localInv.find((p: MerumputInventoryRecord) => p.id === id);
      if (!invItem) return res.status(404).json({ error: "Chemical not found" });

      const tx: MerumputTransactionRecord = {
        id: `tx-${Date.now()}`,
        inventory_id: id,
        type: payload.type,
        quantity: parseFloat(payload.quantity),
        reference: payload.reference || 'Manual Transaction (Fallback)',
        created_at: new Date().toISOString()
      };

      const transactions = getLocalMerumputTransactions() as MerumputTransactionRecord[];
      transactions.unshift(tx);
      saveLocalMerumputTransactions(transactions);

      const qty = parseFloat(payload.quantity);
      if (payload.type === 'IN') {
        invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) + qty;
      } else {
        invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) - qty;
      }
      invItem.updated_at = new Date().toISOString();
      saveLocalMerumputInventory(localInv);

      res.json({ success: true, transaction: tx, newQuantity: invItem.quantity });
    } catch (e: unknown) {
      res.status(500).json({ error: getSafeErrorMessage(e, 'Ralat memproses data merumput.') });
    }
  }
});

router.delete("/merumput/inventory/transactions/:id", requireRole(['pf', 'fc']), async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    if (!supabase) {
      const transactions = getLocalMerumputTransactions() as MerumputTransactionRecord[];
      const txIdx = transactions.findIndex((t: MerumputTransactionRecord) => t.id === id);
      if (txIdx === -1) return res.status(404).json({ error: "Transaction not found" });

      const tx = transactions[txIdx];
      const localInv = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const invItem = localInv.find((i: MerumputInventoryRecord) => i.id === tx.inventory_id);

      if (invItem) {
        const qty = parseFloat(String(tx.quantity));
        if (tx.type === 'IN') {
          invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) - qty;
        } else {
          invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) + qty;
        }
        invItem.updated_at = new Date().toISOString();
        saveLocalMerumputInventory(localInv);
      }

      transactions.splice(txIdx, 1);
      saveLocalMerumputTransactions(transactions);

      return res.json({ success: true, newQuantity: invItem ? invItem.quantity : 0 });
    }

    const { data: tx, error: txError } = await supabase
      .from('merumput_inventory_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (txError) throw txError;

    const { data: inv, error: invError } = await supabase
      .from('merumput_inventory')
      .select('quantity')
      .eq('id', tx.inventory_id)
      .single();

    if (invError) throw invError;

    const qty = parseFloat(tx.quantity);
    const revertedQty = tx.type === 'IN'
      ? (parseFloat(inv.quantity) || 0) - qty
      : (parseFloat(inv.quantity) || 0) + qty;

    await supabase.from('merumput_inventory').update({ quantity: revertedQty, updated_at: new Date().toISOString() }).eq('id', tx.inventory_id);
    await supabase.from('merumput_inventory_transactions').delete().eq('id', id);

    res.json({ success: true, newQuantity: revertedQty });
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      console.warn("Supabase transaction delete failed, fallback to local:", getErrorMessage(err));
    }
    try {
      const { id } = req.params;
      const transactions = getLocalMerumputTransactions() as MerumputTransactionRecord[];
      const txIdx = transactions.findIndex((t: MerumputTransactionRecord) => t.id === id);
      if (txIdx === -1) return res.status(404).json({ error: "Transaction not found" });

      const tx = transactions[txIdx];
      const localInv = getLocalMerumputInventory() as MerumputInventoryRecord[];
      const invItem = localInv.find((i: MerumputInventoryRecord) => i.id === tx.inventory_id);

      if (invItem) {
        const qty = parseFloat(String(tx.quantity));
        if (tx.type === 'IN') {
          invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) - qty;
        } else {
          invItem.quantity = (parseFloat(String(invItem.quantity)) || 0) + qty;
        }
        invItem.updated_at = new Date().toISOString();
        saveLocalMerumputInventory(localInv);
      }

      transactions.splice(txIdx, 1);
      saveLocalMerumputTransactions(transactions);

      res.json({ success: true, newQuantity: invItem ? invItem.quantity : 0 });
    } catch (e: unknown) {
      res.status(500).json({ error: getSafeErrorMessage(e, 'Ralat memproses data merumput.') });
    }
  }
});

export default router;

