import React, { useState, useEffect } from 'react';
import { Worker, WorkAssignment } from '../types';
import { getWorkers, getWorkAssignmentsForDate, getLatestWorkAssignmentsBeforeDate, saveWorkAssignmentsBatch } from '../services';
import { MASTER_DATA } from '../../../utils/constants';
import { getActiveEstateId } from '../../../utils/estateContext';
import { getEstateConfig } from '../../../config/estateRegistry';
import { 
  Calendar as CalendarIcon, Briefcase, Plus, Trash2, Save, Loader2, Users, Clipboard, AlertCircle, Info, Search, HelpCircle, MapPin, Copy, X, Edit, Check, UserPlus, ChevronDown
} from 'lucide-react';

interface AssignmentFormProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const AssignmentForm: React.FC<AssignmentFormProps> = ({ isDarkMode, onShowToast }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<Partial<WorkAssignment>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mode agihan: 'individu' atau 'kumpulan' (Kumpulan Kerja Kekal)
  const [assignMode, setAssignMode] = useState<'individu' | 'kumpulan'>('individu');
  const [formKumpulan, setFormKumpulan] = useState('');
  // Susunan paparan draf: 'individu' atau 'kumpulan'
  const [draftViewMode, setDraftViewMode] = useState<'individu' | 'kumpulan'>('kumpulan');

  // States untuk fungsi Edit
  const [editingIndices, setEditingIndices] = useState<number[]>([]);
  const [editingWorkerIds, setEditingWorkerIds] = useState<string[]>([]);
  const [editingOriginalWorkerIds, setEditingOriginalWorkerIds] = useState<string[]>([]);
  const [selectedAddWorkerId, setSelectedAddWorkerId] = useState('');
  const [editingWorkType, setEditingWorkType] = useState('Menuai');
  const [editingBlok, setEditingBlok] = useState('1');
  const [editingPeringkat, setEditingPeringkat] = useState('Peringkat 1');
  const [editingNotes, setEditingNotes] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  // Form states for adding a new task
  const [formWorkerId, setFormWorkerId] = useState('');
  const [formWorkType, setFormWorkType] = useState('Menuai');
  const [formBlok, setFormBlok] = useState('1');
  const [formPeringkat, setFormPeringkat] = useState('Peringkat 1');
  const [formNotes, setFormNotes] = useState('');

  // Blocks List dynamically resolved from active estate (sorted numerically)
  const activeEstateId = getActiveEstateId();
  const activeEstateCfg = getEstateConfig(activeEstateId);
  const blocksSource = (activeEstateCfg?.blocks && Object.keys(activeEstateCfg.blocks).length > 0)
    ? activeEstateCfg.blocks
    : (activeEstateId === 'FPM_TUNGGAL' ? MASTER_DATA : {});

  const blocksList = Object.keys(blocksSource).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Standardized Job Categories & Sub-activities aligned with KUK Siri 8 & Manual Sawit
  const KUK_JOB_CATEGORIES = [
    {
      category: 'Penuaian & Pengangkutan',
      items: [
        'Menuai BTS (Manual / Cantas)',
        'Pengangkutan Dalaman (MAIC / AAIC)',
        'Mengangkut BTS',
        'Mengutip Biji Lerai',
        'Menuai (Umum)'
      ]
    },
    {
      category: 'Pembajaan',
      items: [
        'Membaja (Separa Mekanisasi)',
        'Membaja (Mekanisasi Penuh / Spreader)',
        'Membaja (Manual / Tabur Beg)',
        'Mengangkut Baja',
        'Tabur EFB (Mulching)',
        'Membaja (Umum)'
      ]
    },
    {
      category: 'Merumput & Kawalan Rumpai',
      items: [
        'Merumput (Bulatan / Circle)',
        'Merumput (Dada / Lorong Tuai)',
        'Merumput (Hamparan / Blanket)',
        'Merumput (Jalan Pertanian / Parit / Pagar)',
        'Merumput (Umum)',
        'Semburan Racun Kimia'
      ]
    },
    {
      category: 'Penyelenggaraan Pokok & P&D',
      items: [
        'Pangkas Pelepah (Pruning)',
        'Susun Pelepah',
        'Mancah / Kawalan P&D (Trunk Injection)',
        'Sulaman / Tanam Semula',
        'Ablasi (Castration)'
      ]
    },
    {
      category: 'Kerja Am Operasi & Kawalan Kualiti',
      items: [
        'Cuci Parit / Longkang / Pembetung',
        'Menanam Anak Sawit / Kemudahan Asas',
        'Bancian Pokok',
        'Tumbuhan Faedah (Beneficial Plant)',
        'Penggredan (EQI - Penggredan BTS)',
        'Penyeliaan / Mandor',
        'Pekerja Am Operasi'
      ]
    }
  ];

  // Flattened list for fallback
  const workTypes = KUK_JOB_CATEGORIES.flatMap(c => c.items);

  const formatWorkType = (wt?: string): string => {
    if (!wt) return '';
    const upper = wt.toUpperCase().trim();

    // Merumput & Kawalan Rumpai
    if (upper.includes('BULATAN') || upper.includes('CIRCLE')) {
      return 'Merumput (Bulatan / Circle)';
    }
    if (upper.includes('DADA') || upper.includes('LORONG TUAI') || upper.includes('LORONG')) {
      return 'Merumput (Dada / Lorong Tuai)';
    }
    if (upper.includes('HAMPARAN') || upper.includes('BLANKET')) {
      return 'Merumput (Hamparan / Blanket)';
    }
    if (upper.includes('JALAN') || upper.includes('PAGAR') || upper.includes('JALAN PERTANIAN')) {
      return 'Merumput (Jalan Pertanian / Parit / Pagar)';
    }
    if (upper.includes('RACUN') || upper.includes('SEMBUK') || upper.includes('HERBISID')) {
      return 'Semburan Racun Kimia';
    }
    if (upper === 'MERUMPUT / MENYEMBUR RACUN' || upper === 'MERUMPUT/MENYEMBUR RACUN' || upper === 'MERUMPUT') {
      return 'Merumput (Umum)';
    }

    // Pembajaan & Kaedah
    if (upper.includes('SEPARA MEKANISASI') || upper.includes('SEPARA') || upper.includes('SEMI-MECH')) {
      return 'Membaja (Separa Mekanisasi)';
    }
    if (upper.includes('MEKANISASI PENUH') || upper.includes('PENUH') || upper.includes('SPREADER') || upper.includes('FULL-MECH')) {
      return 'Membaja (Mekanisasi Penuh / Spreader)';
    }
    if (upper.includes('TABUR BEG') || upper.includes('MANUAL BEG') || upper.includes('TABUR POKOK')) {
      return 'Membaja (Manual / Tabur Beg)';
    }
    if (upper.includes('ANGKUT BAJA') || upper.includes('PENGANGKUTAN BAJA')) {
      return 'Mengangkut Baja';
    }
    if (upper.includes('EFB') || upper.includes('TANDAN KOSONG') || upper.includes('MULCHING')) {
      return 'Tabur EFB (Mulching)';
    }
    if (upper === 'MEMBAJA' || upper === 'BAJA' || upper === 'PEMBAJA') {
      return 'Membaja (Umum)';
    }

    // Penuaian & Pengangkutan
    if (upper.includes('MAIC') || upper.includes('AAIC') || upper.includes('PENGANGKUTAN DALAMAN')) {
      return 'Pengangkutan Dalaman (MAIC / AAIC)';
    }
    if (upper.includes('ANGKUT BTS') || upper.includes('PENGANGKUTAN BTS')) {
      return 'Mengangkut BTS';
    }
    if (upper.includes('BIJI') || upper.includes('LERAI') || upper.includes('RELAI') || upper.includes('LOOSE FRUIT')) {
      return 'Mengutip Biji Lerai';
    }
    if (upper.includes('MENUAI') || upper.includes('HARVEST') || upper.includes('CANTAS') || upper.includes('PAHAT') || upper.includes('EGREK')) {
      return 'Menuai BTS (Manual / Cantas)';
    }

    // Penyelenggaraan & P&D
    if (upper.includes('PRUNING') || upper.includes('PANGKAS') || upper.includes('PEMANGKASAN')) {
      return 'Pangkas Pelepah (Pruning)';
    }
    if (upper.includes('SUSUN PELEPAH') || upper.includes('SUSUN')) {
      return 'Susun Pelepah';
    }
    if (upper.includes('MANCAH') || upper.includes('TRUNK INJECTION') || upper.includes('INJECTION') || upper.includes('P&D') || upper.includes('PEROSAK') || upper.includes('ULAT')) {
      return 'Mancah / Kawalan P&D (Trunk Injection)';
    }
    if (upper.includes('SULAMAN') || upper.includes('TANAM SEMULA') || upper.includes('SUPPLYING')) {
      return 'Sulaman / Tanam Semula';
    }
    if (upper.includes('ABLASI') || upper.includes('CASTRATION')) {
      return 'Ablasi (Castration)';
    }

    // Kerja Am & Kualiti
    if (upper.includes('PARIT') || upper.includes('CULVERT') || upper.includes('LONGKANG') || upper.includes('PEMBETUNG')) {
      return 'Cuci Parit / Longkang / Pembetung';
    }
    if (upper.includes('BENEFICIAL') || upper.includes('TURNERA') || upper.includes('FAEDAH')) {
      return 'Tumbuhan Faedah (Beneficial Plant)';
    }
    if (upper.includes('BANCI') || upper.includes('CENSUS')) {
      return 'Bancian Pokok';
    }
    if (upper.includes('MENANAM ANAK') || upper.includes('KEMUDAHAN ASAS')) {
      return 'Menanam Anak Sawit / Kemudahan Asas';
    }
    if (upper.includes('EQI') || upper.includes('GRED') || upper.includes('GRADING') || upper.includes('KUALITI BTS')) {
      return 'Penggredan (EQI - Penggredan BTS)';
    }
    if (upper.includes('MANDOR') || upper.includes('PENYELIA') || upper.includes('SUPERVISOR')) {
      return 'Penyeliaan / Mandor';
    }
    if (upper.includes('AM') || upper.includes('OPERASI')) {
      return 'Pekerja Am Operasi';
    }

    return wt;
  };

  const getStageForBlock = (blockStr: string): string => {
    const numericMatch = blockStr.match(/\d+/);
    if (numericMatch) {
      const num = parseInt(numericMatch[0], 10);
      if (num >= 1 && num <= 17) {
        return 'Peringkat 1';
      } else if (num >= 18 && num <= 22) {
        return 'Peringkat 2';
      } else if (num === 88) {
        return 'Peringkat 3';
      }
    }
    return 'Peringkat 1';
  };

  const formatPeringkat = (p?: string) => {
    if (!p) return '';
    return p.replace('Peringkat', 'Pkt.');
  };

  const getAvailableKumpulans = (workersList: Worker[] = workers) => {
    const kps = Array.from(new Set(workersList.map(w => w.kumpulan).filter(Boolean))) as string[];
    return kps.length > 0 ? kps : ['Penggredan / Gredding', 'Gredding', 'Kerja Am dan Lain-lain', 'Pembaja', 'Semburan Racun'];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const workersList = await getWorkers();
      const activeWorkers = workersList.filter(w => w.is_active !== false);
      setWorkers(activeWorkers);

      // Set default worker in form
      if (activeWorkers.length > 0) {
        setFormWorkerId(activeWorkers[0].id);
        const kps = getAvailableKumpulans(activeWorkers);
        if (kps.length > 0) {
          setFormKumpulan(kps[0]);
        }
      }

      const existing = await getWorkAssignmentsForDate(selectedDate);
      if (existing && existing.length > 0) {
        setAssignments(existing);
      } else {
        setAssignments([]);
      }
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat tugasan kerja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let updated: Partial<WorkAssignment>[] = [];

    if (assignMode === 'individu') {
      if (!formWorkerId) {
        onShowToast('error', 'Sila pilih pekerja.');
        return;
      }

      // Verify if worker is already assigned a task
      const isAlreadyAssigned = assignments.some(a => String(a.worker_id) === String(formWorkerId));
      if (isAlreadyAssigned) {
        onShowToast('error', 'Pekerja ini sudah diberikan tugasan untuk tarikh ini.');
        return;
      }

      const workerObj = workers.find(w => String(w.id) === String(formWorkerId));
      if (!workerObj) return;

      const newTask: Partial<WorkAssignment> = {
        worker_id: formWorkerId,
        date: selectedDate,
        work_type: formWorkType,
        blok: formBlok,
        peringkat: formPeringkat,
        notes: formNotes.trim().toUpperCase(),
        worker: workerObj
      };

      updated = [newTask, ...assignments];
      setAssignments(updated);
      setFormNotes('');
      onShowToast('success', `Tugasan untuk ${workerObj.name} ditambah & disimpan.`);
    } else {
      // Kumpulan Kerja Mode
      const targetKumpulan = formKumpulan || getAvailableKumpulans()[0];
      const groupWorkers = workers.filter(w => (w.kumpulan || 'Kerja Am dan Lain-lain') === targetKumpulan);

      if (groupWorkers.length === 0) {
        onShowToast('error', `Tiada pekerja aktif ditemui dalam Kumpulan ${targetKumpulan}.`);
        return;
      }

      const newTasks: Partial<WorkAssignment>[] = [];
      let alreadyAssignedCount = 0;

      groupWorkers.forEach(w => {
        const isAlreadyAssigned = assignments.some(a => String(a.worker_id) === String(w.id));
        if (isAlreadyAssigned) {
          alreadyAssignedCount++;
        } else {
          newTasks.push({
            worker_id: w.id,
            date: selectedDate,
            work_type: formWorkType,
            blok: formBlok,
            peringkat: formPeringkat,
            notes: formNotes.trim().toUpperCase(),
            worker: w
          });
        }
      });

      if (newTasks.length === 0) {
        onShowToast('error', `Semua pekerja dalam Kumpulan ${targetKumpulan} sudah mempunyai tugasan.`);
        return;
      }

      updated = [...newTasks, ...assignments];
      setAssignments(updated);
      setFormNotes('');
      
      if (alreadyAssignedCount > 0) {
        onShowToast('success', `${newTasks.length} pekerja dari Kumpulan ${targetKumpulan} ditambah (${alreadyAssignedCount} sudah ada tugasan).`);
      } else {
        onShowToast('success', `Semua ${newTasks.length} pekerja dari Kumpulan ${targetKumpulan} berjaya ditambah.`);
      }
    }

    // Auto-save to Supabase & LocalStorage
    try {
      const toSave = updated.map(a => {
        const { worker, ...rest } = a;
        return { ...rest, date: selectedDate };
      });
      await saveWorkAssignmentsBatch(selectedDate, toSave);
    } catch (err) {
      console.warn("Auto-save error:", err);
    }
  };

  const handleRemoveAssignment = async (index: number) => {
    const updated = assignments.filter((_, idx) => idx !== index);
    setAssignments(updated);
    onShowToast('success', 'Tugasan dibuang.');
    try {
      const toSave = updated.map(a => {
        const { worker, ...rest } = a;
        return { ...rest, date: selectedDate };
      });
      await saveWorkAssignmentsBatch(selectedDate, toSave);
    } catch (err) {
      console.warn("Auto-save on remove error:", err);
    }
  };

  const handleSaveAssignments = async () => {
    try {
      setSaving(true);
      const toSave = assignments.map(a => {
        const { worker, ...rest } = a;
        return { ...rest, date: selectedDate };
      });

      await saveWorkAssignmentsBatch(selectedDate, toSave);
      onShowToast('success', `Tugasan kerja pada ${selectedDate.split('-').reverse().join('.')} berjaya disimpan.`);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal menyimpan tugasan kerja: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const [copyingYesterday, setCopyingYesterday] = useState(false);

  const handleCopyYesterday = async () => {
    try {
      setCopyingYesterday(true);
      
      const { assignments: foundAssignments, date: foundDateStr } = await getLatestWorkAssignmentsBeforeDate(selectedDate);

      if (foundAssignments.length === 0) {
        onShowToast('error', 'Tiada rekod tugasan ditemui dalam rekod terdahulu.');
        return;
      }

      // Filter & padankan pekerja yang aktif
      const copied: Partial<WorkAssignment>[] = [];

      foundAssignments.forEach(prev => {
        const prevWorkerId = prev.worker_id || prev.worker?.id;
        const workerObj = workers.find(w => 
          String(w.id) === String(prevWorkerId) ||
          (w.name && prev.worker?.name && w.name.trim().toLowerCase() === prev.worker.name.trim().toLowerCase())
        );

        if (workerObj) {
          copied.push({
            worker_id: workerObj.id,
            date: selectedDate,
            work_type: prev.work_type,
            blok: prev.blok,
            peringkat: prev.peringkat,
            notes: prev.notes || '',
            worker: workerObj
          });
        } else if (prev.worker) {
          copied.push({
            worker_id: prev.worker.id || prevWorkerId,
            date: selectedDate,
            work_type: prev.work_type,
            blok: prev.blok,
            peringkat: prev.peringkat,
            notes: prev.notes || '',
            worker: prev.worker
          });
        }
      });

      if (copied.length === 0) {
        onShowToast('error', 'Tiada pekerja daripada tugasan terdahulu yang dikesan sebagai aktif sekarang.');
        return;
      }

      // Gabungkan dengan draf sedia ada (elakkan pertindihan pekerja yang sama)
      const merged: Partial<WorkAssignment>[] = [...assignments];
      copied.forEach(newItem => {
        const existsIdx = merged.findIndex(item => String(item.worker_id) === String(newItem.worker_id));
        if (existsIdx >= 0) {
          // Kemas kini jika sudah ada
          merged[existsIdx] = newItem;
        } else {
          // Tambah baru jika tiada
          merged.push(newItem);
        }
      });

      setAssignments(merged);

      // Simpan terus secara automatik ke pangkalan data & storan supaya kekal dan terbaca di Muster Chit
      const toSave = merged.map(a => {
        const { worker, ...rest } = a;
        return { ...rest, date: selectedDate };
      });
      await saveWorkAssignmentsBatch(selectedDate, toSave);

      const formattedFoundDate = foundDateStr ? foundDateStr.split('-').reverse().join('/') : 'terdahulu';
      onShowToast('success', `${copied.length} tugasan dari ${formattedFoundDate} berjaya disalin & disimpan secara kekal!`);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal menyalin tugasan: ' + err.message);
    } finally {
      setCopyingYesterday(false);
    }
  };

  // Helper untuk mendapatkan draf yang dikumpulkan mengikut Kumpulan Kerja
  const handleRemoveGroupAssignments = (groupName: string) => {
    setAssignments(prev => prev.filter(a => {
      const wGroup = a.worker?.kumpulan || 'TIADA KUMPULAN / LAIN-LAIN';
      return wGroup !== groupName;
    }));
    onShowToast('success', `Semua draf tugasan untuk Kumpulan ${groupName} telah dibuang.`);
  };

  const getGroupedDrafts = () => {
    const groupedMap: { [groupName: string]: (Partial<WorkAssignment> & { originalIndex: number })[] } = {};
    
    filteredAssignments.forEach((a) => {
      const origIdx = assignments.findIndex(orig => orig.worker_id === a.worker_id);
      const groupName = a.worker?.kumpulan || 'TIADA KUMPULAN / LAIN-LAIN';
      if (!groupedMap[groupName]) {
        groupedMap[groupName] = [];
      }
      groupedMap[groupName].push({ ...a, originalIndex: origIdx });
    });

    const result: {
      groupName: string;
      totalWorkers: number;
      assignments: {
        work_type: string;
        blok: string;
        peringkat: string;
        notes: string;
        workers: {
          id: string;
          name: string;
          worker_no: string;
          originalIndex: number;
        }[];
      }[];
    }[] = [];

    Object.keys(groupedMap).forEach(groupName => {
      const items = groupedMap[groupName];
      const taskGroupsMap: { [taskKey: string]: typeof items } = {};

      items.forEach(item => {
        const taskKey = `${item.work_type || ''}|||${item.blok || ''}|||${item.peringkat || ''}|||${item.notes || ''}`;
        if (!taskGroupsMap[taskKey]) {
          taskGroupsMap[taskKey] = [];
        }
        taskGroupsMap[taskKey].push(item);
      });

      const taskGroups = Object.keys(taskGroupsMap).map(taskKey => {
        const parts = taskKey.split('|||');
        const work_type = parts[0];
        const blok = parts[1];
        const peringkat = parts[2];
        const notes = parts[3];
        const list = taskGroupsMap[taskKey];

        return {
          work_type,
          blok,
          peringkat,
          notes,
          workers: list.map(item => ({
            id: item.worker_id || '',
            name: item.worker?.name || 'Pekerja',
            worker_no: item.worker?.worker_no || '',
            originalIndex: item.originalIndex
          }))
        };
      });

      result.push({
        groupName,
        totalWorkers: items.length,
        assignments: taskGroups
      });
    });

    return result.sort((a, b) => {
      if (a.groupName.includes('TIADA KUMPULAN')) return 1;
      if (b.groupName.includes('TIADA KUMPULAN')) return -1;
      return a.groupName.localeCompare(b.groupName);
    });
  };

  // Filtered draf assignments
  const filteredAssignments = assignments.filter(a => {
    const name = a.worker?.name || '';
    const no = a.worker?.worker_no || '';
    const task = a.work_type || '';
    const query = searchTerm.toLowerCase();
    return name.toLowerCase().includes(query) || 
           no.toLowerCase().includes(query) || 
           task.toLowerCase().includes(query);
  });

  const handleEditGroup = (
    groupName: string,
    taskObj: {
      work_type: string;
      blok: string;
      peringkat: string;
      notes: string;
      workers: { originalIndex: number; id?: string }[];
    }
  ) => {
    const indices = taskObj.workers.map(w => w.originalIndex);
    const workerIds = taskObj.workers
      .map(w => String(w.id || assignments[w.originalIndex]?.worker_id || assignments[w.originalIndex]?.worker?.id || ''))
      .filter(Boolean);

    setEditingIndices(indices);
    setEditingWorkerIds(workerIds);
    setEditingOriginalWorkerIds(workerIds);
    setSelectedAddWorkerId('');
    setEditingWorkType(taskObj.work_type);
    setEditingBlok(taskObj.blok);
    setEditingPeringkat(taskObj.peringkat);
    setEditingNotes(taskObj.notes || '');
    setEditingTitle(`Kumpulan ${groupName}`);
    setShowEditModal(true);
  };

  const handleEditIndividual = (originalIndex: number, item: Partial<WorkAssignment>) => {
    const wId = String(item.worker_id || item.worker?.id || '');
    const workerIds = wId ? [wId] : [];

    setEditingIndices([originalIndex]);
    setEditingWorkerIds(workerIds);
    setEditingOriginalWorkerIds(workerIds);
    setSelectedAddWorkerId('');
    setEditingWorkType(item.work_type || 'Membaja');
    setEditingBlok(item.blok || '1');
    setEditingPeringkat(item.peringkat || 'Peringkat 1');
    setEditingNotes(item.notes || '');
    setEditingTitle(`${item.worker?.name || 'Pekerja'}`);
    setShowEditModal(true);
  };

  const handleAddWorkerToEditModal = (workerIdToAdd?: string) => {
    const targetId = String(workerIdToAdd || selectedAddWorkerId || '');
    if (!targetId) return;
    if (editingWorkerIds.includes(targetId)) {
      onShowToast('error', 'Pekerja ini sudah ada dalam senarai tugasan ini.');
      setSelectedAddWorkerId('');
      return;
    }
    const workerObj = workers.find(w => String(w.id) === targetId);
    setEditingWorkerIds(prev => [...prev, targetId]);
    setSelectedAddWorkerId('');
    onShowToast('success', `${workerObj?.name || 'Pekerja'} berjaya ditambah.`);
  };

  const handleRemoveWorkerFromEditModal = (rawWorkerId: string) => {
    const wId = String(rawWorkerId);
    if (editingWorkerIds.length <= 1) {
      onShowToast('error', 'Mesti ada sekurang-kurangnya 1 pekerja dalam tugasan ini.');
      return;
    }
    const workerObj = workers.find(w => String(w.id) === wId);
    setEditingWorkerIds(prev => prev.filter(id => id !== wId));
    onShowToast('success', `${workerObj?.name || 'Pekerja'} dikeluarkan.`);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWorkerIds.length === 0) {
      onShowToast('error', 'Sila pilih sekurang-kurangnya seorang pekerja.');
      return;
    }

    // Workers removed in modal
    const removedWorkerIds = editingOriginalWorkerIds.filter(id => !editingWorkerIds.includes(id));

    // Remove unassigned workers
    let updatedAssignments = assignments.filter(a => {
      const wId = String(a.worker_id || a.worker?.id || '');
      return !removedWorkerIds.includes(wId);
    });

    // Update or insert for each active worker in modal
    editingWorkerIds.forEach(wId => {
      const existingIdx = updatedAssignments.findIndex(a => String(a.worker_id || a.worker?.id || '') === String(wId));
      const workerObj = workers.find(w => String(w.id) === String(wId));

      const assignmentData: Partial<WorkAssignment> = {
        worker_id: wId,
        date: selectedDate,
        work_type: editingWorkType,
        blok: editingBlok,
        peringkat: editingPeringkat,
        notes: editingNotes.trim().toUpperCase(),
        worker: workerObj || updatedAssignments[existingIdx]?.worker
      };

      if (existingIdx >= 0) {
        updatedAssignments[existingIdx] = {
          ...updatedAssignments[existingIdx],
          ...assignmentData
        };
      } else {
        updatedAssignments.push(assignmentData);
      }
    });

    setAssignments(updatedAssignments);
    setShowEditModal(false);
    setEditingIndices([]);
    setEditingWorkerIds([]);
    setEditingOriginalWorkerIds([]);
    onShowToast('success', 'Tugasan dan senarai pekerja berjaya dikemas kini & disimpan.');

    try {
      const toSave = updatedAssignments.map(a => {
        const { worker, ...rest } = a;
        return { ...rest, date: selectedDate };
      });
      await saveWorkAssignmentsBatch(selectedDate, toSave);
    } catch (err) {
      console.warn("Auto-save on edit error:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Date Selector block */}
      <div className={`p-5 rounded-3xl border ${
        isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'
      } flex flex-col sm:flex-row gap-4 items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Briefcase size={20} />
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Agihan Tugasan Kerja
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Atur lokasi dan aktiviti pekerja harian.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Copy Yesterday Button */}
          <button
            onClick={handleCopyYesterday}
            disabled={copyingYesterday}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
              isDarkMode 
                ? 'bg-slate-800 border-white/5 text-slate-300 hover:bg-slate-700/80 hover:text-white' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Salin semua tugasan dari hari sebelumnya ke tarikh draf ini"
          >
            {copyingYesterday ? (
              <Loader2 className="animate-spin text-emerald-500" size={14} />
            ) : (
              <Copy className="text-emerald-500" size={14} />
            )}
            {copyingYesterday ? 'Menyalin...' : 'Salin Tugasan Kelmarin'}
          </button>

          <div className="relative w-full sm:w-auto">
            <CalendarIcon className="absolute left-4 top-3 text-slate-400" size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full sm:w-48 pl-12 pr-4 py-2.5 border rounded-2xl outline-none text-xs font-black uppercase tracking-wider ${
                isDarkMode 
                  ? 'bg-slate-800 border-white/5 text-white focus:border-emerald-500' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Memuatkan Tugasan...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: ADD ASSIGNMENT FORM */}
          <div className={`lg:col-span-1 p-6 rounded-3xl border h-fit ${
            isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-100'
          }`}>
            <h4 className={`text-xs font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              <Plus size={16} className="text-emerald-500" />
              Tambah Tugasan
            </h4>

            {workers.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold uppercase">Tiada pekerja aktif untuk ditugaskan.</p>
            ) : (
              <form onSubmit={handleAddAssignment} className="space-y-4 text-xs font-bold uppercase">
                {/* Kaedah Agihan */}
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Kaedah Agihan</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/40 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setAssignMode('individu')}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                        assignMode === 'individu'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      👤 Individu
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignMode('kumpulan')}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                        assignMode === 'kumpulan'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      👥 Kumpulan
                    </button>
                  </div>
                </div>

                {/* Conditional Fields based on Assign Mode */}
                {assignMode === 'individu' ? (
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Pilih Pekerja</label>
                    <select
                      value={formWorkerId}
                      onChange={(e) => setFormWorkerId(e.target.value)}
                      className={`w-full p-3 border rounded-xl outline-none font-bold ${
                        isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      {workers.map(w => (
                        <option key={w.id} value={w.id} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                          {w.name} ({w.worker_no})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Kumpulan Kerja Kekal</label>
                    <select
                      value={formKumpulan}
                      onChange={(e) => setFormKumpulan(e.target.value)}
                      className={`w-full p-3 border rounded-xl outline-none font-bold ${
                        isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      {getAvailableKumpulans().map(gk => (
                        <option key={gk} value={gk} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                          {gk}
                        </option>
                      ))}
                    </select>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold leading-normal">
                      Sistem akan mengagihkan tugasan ini secara serentak kepada semua ahli kumpulan yang aktif.
                    </p>
                  </div>
                )}

                {/* Select Activity */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[9px] text-slate-400 uppercase font-black">Aktiviti / Kerja (KUK Siri 8)</label>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">
                      Piawai KUK
                    </span>
                  </div>
                  <select
                    value={formWorkType}
                    onChange={(e) => setFormWorkType(e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    {KUK_JOB_CATEGORIES.map(group => (
                      <optgroup key={group.category} label={group.category.toUpperCase()} className={isDarkMode ? 'bg-slate-900 text-slate-400 font-bold' : 'bg-slate-100 text-slate-700 font-bold'}>
                        {group.items.map(t => (
                          <option key={t} value={t} className={isDarkMode ? 'bg-slate-800 text-white font-medium' : 'bg-white text-slate-900 font-medium'}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Perincian KUK Quick Chips */}
                  <div className="mt-2">
                    <p className="text-[8px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <span>⚡ Perincian Pantas:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {formWorkType.toLowerCase().includes('merumput') || formWorkType.toLowerCase().includes('racun') ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Merumput (Bulatan / Circle)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Merumput (Bulatan / Circle)'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            ⭕ Bulatan (Circle)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Merumput (Dada / Lorong Tuai)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Merumput (Dada / Lorong Tuai)'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            🛣️ Dada / Lorong Tuai
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Merumput (Hamparan / Blanket)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Merumput (Hamparan / Blanket)'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            🌾 Hamparan (Blanket)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Merumput (Jalan Pertanian / Parit / Pagar)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Merumput (Jalan Pertanian / Parit / Pagar)'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            🚜 Jalan / Parit / Pagar
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Semburan Racun Kimia')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Semburan Racun Kimia'
                                ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                          >
                            🧪 Semburan Racun
                          </button>
                        </>
                      ) : formWorkType.toLowerCase().includes('baja') ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Membaja (Separa Mekanisasi)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Membaja (Separa Mekanisasi)'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            ⚙️ Separa Mekanisasi
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Membaja (Mekanisasi Penuh / Spreader)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Membaja (Mekanisasi Penuh / Spreader)'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            🚜 Mekanisasi Penuh (Spreader)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Membaja (Manual / Tabur Beg)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Membaja (Manual / Tabur Beg)'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            👜 Manual / Tabur Beg
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Tabur EFB (Mulching)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Tabur EFB (Mulching)'
                                ? 'bg-yellow-600 text-white border-yellow-600 shadow-sm'
                                : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20'
                            }`}
                          >
                            🪵 Tabur EFB
                          </button>
                        </>
                      ) : formWorkType.toLowerCase().includes('tuai') || formWorkType.toLowerCase().includes('biji') ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Menuai BTS (Manual / Cantas)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Menuai BTS (Manual / Cantas)'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                : 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20'
                            }`}
                          >
                            🌴 Menuai BTS (Manual/Cantas)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Mengutip Biji Lerai')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Mengutip Biji Lerai'
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20'
                            }`}
                          >
                            🧺 Kutip Biji Lerai
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Pengangkutan Dalaman (MAIC / AAIC)')}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                              formWorkType === 'Pengangkutan Dalaman (MAIC / AAIC)'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                : 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20'
                            }`}
                          >
                            🚜 Pengangkutan MAIC/AAIC
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Merumput (Bulatan / Circle)')}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                          >
                            ⭕ Merumput Bulatan
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Membaja (Separa Mekanisasi)')}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                          >
                            ⚙️ Membaja Separa Mekanisasi
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Pangkas Pelepah (Pruning)')}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20"
                          >
                            ✂️ Pangkas Pelepah
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormWorkType('Penggredan (EQI - Penggredan BTS)')}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 hover:bg-cyan-500/20"
                          >
                            🔍 Penggredan (EQI)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid for Block and Stage */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Blok</label>
                    <select
                      value={formBlok}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormBlok(val);
                        setFormPeringkat(getStageForBlock(val));
                      }}
                      className={`w-full p-3 border rounded-xl outline-none font-bold font-mono ${
                        isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      {blocksList.map(b => (
                        <option key={b} value={b} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                          Blok {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Peringkat</label>
                    <select
                      value={formPeringkat}
                      onChange={(e) => setFormPeringkat(e.target.value)}
                      className={`w-full p-3 border rounded-xl outline-none font-bold ${
                        isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="Peringkat 1" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 1</option>
                      <option value="Peringkat 2" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 2</option>
                      <option value="Peringkat 3" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 3</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1.5">Nota Tambahan</label>
                  <input
                    type="text"
                    placeholder="Contoh: KAWASAN CURAM, dsb."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none font-bold placeholder-slate-400 ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Plus size={14} />
                  Tambah ke Draf
                </button>
              </form>
            )}
          </div>

          {/* RIGHT: DRAFT ASSIGNMENT LIST (Screenshot 2 style) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/50 dark:bg-slate-900/20 p-3.5 rounded-2xl border border-slate-200/40 dark:border-white/5">
              <div className="flex flex-col gap-0.5">
                <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  📝 Draf Tugasan Kerja Harian
                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 px-2.5 py-0.5 rounded-full text-[9px]">
                    {assignments.length} Agihan
                  </span>
                </h4>
                <p className="text-[8px] text-slate-400 font-bold uppercase">Kompak & diasingkan mengikut kumpulan atau individu.</p>
              </div>

              {/* View mode toggle with segmented buttons & search */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/40 dark:border-white/5">
                  <button
                    onClick={() => setDraftViewMode('kumpulan')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
                      draftViewMode === 'kumpulan'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Paparan kompak mengikut Kumpulan Kerja Tetap"
                  >
                    👥 Kumpulan
                  </button>
                  <button
                    onClick={() => setDraftViewMode('individu')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
                      draftViewMode === 'individu'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Paparan senarai pekerja individu"
                  >
                    👤 Individu
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative flex-1 sm:max-w-[140px]">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={12} />
                  <input
                    type="text"
                    placeholder="Cari draf..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-7 pr-3 py-1.5 border rounded-xl outline-none text-[9px] font-black uppercase ${
                      isDarkMode
                        ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className={`p-12 text-center rounded-3xl border flex flex-col items-center justify-center ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-100 shadow-sm'
              }`}>
                <Clipboard size={44} className="text-slate-400 mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-500 uppercase">Tiada Tugasan Diatur</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Gunakan borang di sebelah kiri untuk menambah draf tugasan kerja harian.</p>
                <button
                  onClick={handleCopyYesterday}
                  disabled={copyingYesterday}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:bg-slate-300"
                >
                  {copyingYesterday ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                  {copyingYesterday ? 'Menyalin...' : 'Salin Tugasan Kelmarin'}
                </button>
              </div>
            ) : draftViewMode === 'kumpulan' ? (
              /* GROUPED VIEW (KOMPAK & KUMPULAN KERJA KEKAL) */
              <div className="space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                {getGroupedDrafts().map((groupObj, groupIdx) => (
                  <div
                    key={groupIdx}
                    className={`p-4 rounded-3xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-900/50 border-white/5 hover:border-white/10'
                        : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/40 dark:border-white/5 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <Users size={14} />
                        </div>
                        <div>
                          <h5 className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {groupObj.groupName}
                          </h5>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase">
                          {groupObj.totalWorkers} Ahli
                        </span>
                        <button
                          onClick={() => handleRemoveGroupAssignments(groupObj.groupName)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all"
                          title={`Padam semua draf tugasan untuk Kumpulan ${groupObj.groupName}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Group's Task Assignments List */}
                    <div className="space-y-3">
                      {groupObj.assignments.map((task, taskIdx) => (
                        <div
                          key={taskIdx}
                          className={`p-3 rounded-2xl ${
                            isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50'
                          } border border-slate-200/20`}
                        >
                          {/* Task Badges & Edit Action */}
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
                                🔨 {formatWorkType(task.work_type)}
                              </span>
                              <span className="bg-blue-500/10 text-blue-500 border border-blue-500/10 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
                                📊 {formatPeringkat(task.peringkat)}
                              </span>
                              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/10 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase font-mono">
                                📍 BLOK {task.blok}
                              </span>
                              {task.notes && (
                                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/10 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
                                  📝 {task.notes}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleEditGroup(groupObj.groupName, task)}
                              className="p-1 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-500/10 transition-all shrink-0"
                              title="Kemaskini tugasan kumpulan ini"
                            >
                              <Edit size={12} />
                            </button>
                          </div>

                          {/* Inline Worker List for this assignment */}
                          <div className="flex flex-col gap-1.5 items-start">
                            {task.workers.map((worker, idx) => (
                              <div
                                key={worker.id}
                                className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-[9px] font-black uppercase transition-all ${
                                  isDarkMode
                                    ? 'bg-slate-800 border border-white/5 text-slate-300 hover:text-white hover:bg-slate-750'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                              >
                                <span>{idx + 1}. {worker.name}</span>
                                <button
                                  onClick={() => handleRemoveAssignment(worker.originalIndex)}
                                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-all active:scale-90"
                                  title="Keluarkan pekerja ini dari draf"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* INDIVIDUAL FLAT VIEW */
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                {filteredAssignments.map((item, index) => {
                  const workerName = item.worker?.name || 'Pekerja Tidak Diketahui';
                  const workerNo = item.worker?.worker_no || '-';
                  const role = item.worker?.role || '-';
                  
                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                        isDarkMode 
                          ? 'bg-slate-900/60 border-white/5 hover:border-white/10' 
                          : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {/* Worker Info */}
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <h5 className={`text-[11px] font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {workerName}
                          </h5>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5 ml-4 uppercase">{workerNo} • {role}</p>
                        
                        {/* Assignment Badges */}
                        <div className="flex flex-wrap gap-1.5 mt-3 ml-4">
                          <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase">
                            🔨 {formatWorkType(item.work_type)}
                          </span>
                          <span className="bg-blue-500/10 text-blue-500 border border-blue-500/10 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase">
                            📊 {formatPeringkat(item.peringkat)}
                          </span>
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/10 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase font-mono">
                            📍 BLOK {item.blok}
                          </span>
                          {item.notes && (
                            <span className="bg-rose-500/10 text-rose-500 border border-rose-500/10 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase">
                              📝 {item.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const originalIndex = assignments.findIndex(orig => orig.worker_id === item.worker_id);
                            if (originalIndex >= 0) {
                              handleEditIndividual(originalIndex, item);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                          title="Kemaskini tugasan"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const originalIndex = assignments.findIndex(orig => orig.worker_id === item.worker_id);
                            if (originalIndex >= 0) {
                              handleRemoveAssignment(originalIndex);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                          title="Buang tugasan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save Buttons & Action Block */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase font-black">
                <Info size={13} className="text-emerald-500 shrink-0" />
                Draf belum disimpan kekal ke pangkalan data utama.
              </div>

              {assignments.length > 0 && (
                <button
                  onClick={handleSaveAssignments}
                  disabled={saving}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white font-black text-xs uppercase tracking-wider py-3.5 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Simpan Tugasan Kerja
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT TUGASAN */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity cursor-pointer" 
            onClick={() => {
              setShowEditModal(false);
              setEditingIndices([]);
            }}
          />

          {/* Modal Box */}
          <div className={`relative w-full max-w-md transform overflow-hidden rounded-3xl border p-6 text-left align-middle shadow-2xl transition-all ${
            isDarkMode 
              ? 'bg-slate-900 border-white/5 text-white shadow-emerald-500/5' 
              : 'bg-white border-slate-100 text-slate-900 shadow-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/40 dark:border-white/5 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Edit size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Kemaskini Tugasan</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{editingTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingIndices([]);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Select Activity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[9px] text-slate-400 uppercase font-black">Aktiviti / Kerja (KUK Siri 8)</label>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">
                    Piawai KUK
                  </span>
                </div>
                <select
                  value={editingWorkType}
                  onChange={(e) => setEditingWorkType(e.target.value)}
                  className={`w-full p-3 border rounded-xl outline-none font-bold text-xs ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  {KUK_JOB_CATEGORIES.map(group => (
                    <optgroup key={group.category} label={group.category.toUpperCase()} className={isDarkMode ? 'bg-slate-900 text-slate-400 font-bold' : 'bg-slate-100 text-slate-700 font-bold'}>
                      {group.items.map(t => (
                        <option key={t} value={t} className={isDarkMode ? 'bg-slate-800 text-white font-medium' : 'bg-white text-slate-900 font-medium'}>
                          {t}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {/* Perincian KUK Quick Chips in Modal */}
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {editingWorkType.toLowerCase().includes('merumput') || editingWorkType.toLowerCase().includes('racun') ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Merumput (Bulatan / Circle)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                        >
                          ⭕ Bulatan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Merumput (Dada / Lorong Tuai)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                        >
                          🛣️ Dada/Lorong
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Merumput (Hamparan / Blanket)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                        >
                          🌾 Hamparan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Semburan Racun Kimia')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
                        >
                          🧪 Semburan Racun
                        </button>
                      </>
                    ) : editingWorkType.toLowerCase().includes('baja') ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Membaja (Separa Mekanisasi)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                        >
                          ⚙️ Separa Mekanisasi
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Membaja (Mekanisasi Penuh / Spreader)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                        >
                          🚜 Spreader Mekanisasi
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkType('Tabur EFB (Mulching)')}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20"
                        >
                          🪵 Tabur EFB
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Grid for Block and Stage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1.5 font-bold">Blok</label>
                  <select
                    value={editingBlok}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingBlok(val);
                      setEditingPeringkat(getStageForBlock(val));
                    }}
                    className={`w-full p-3 border rounded-xl outline-none font-bold font-mono text-xs ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    {blocksList.map(b => (
                      <option key={b} value={b} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        Blok {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1.5 font-bold">Peringkat</label>
                  <select
                    value={editingPeringkat}
                    onChange={(e) => setEditingPeringkat(e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Peringkat 1" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 1</option>
                    <option value="Peringkat 2" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 2</option>
                    <option value="Peringkat 3" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Peringkat 3</option>
                  </select>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-[9px] text-slate-400 uppercase mb-1.5 font-bold">Catatan / Perincian (Opsional)</label>
                <input
                  type="text"
                  placeholder="CONTOH: KAWASAN CURAM / BAJA P/O..."
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className={`w-full p-3 border rounded-xl outline-none text-xs font-bold uppercase ${
                    isDarkMode 
                      ? 'bg-slate-800 border-white/5 text-white placeholder-slate-500 focus:border-emerald-500' 
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Ruang Ahli / Penambahan Pekerja Dalam Tugasan (Mobile Responsive) */}
              <div className="pt-4 border-t border-slate-200/40 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-500" />
                    Pekerja Terlibat ({editingWorkerIds.length})
                  </label>
                  <span className="text-[9px] text-slate-400 uppercase font-medium">Boleh tambah / buang ahli</span>
                </div>

                {/* Senarai Pekerja Terlibat (Chips) dengan Tap Target Lebih Besar */}
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 rounded-2xl border bg-slate-500/5 border-slate-200/40 dark:border-white/5">
                  {editingWorkerIds.length === 0 ? (
                    <span className="text-xs text-rose-400 font-bold italic py-1">Tiada pekerja dipilih. Sila pilih & tambah di bawah.</span>
                  ) : (
                    editingWorkerIds.map(wId => {
                      const wObj = workers.find(w => String(w.id) === String(wId));
                      return (
                        <div 
                          key={wId}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            isDarkMode 
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span className="truncate max-w-[160px]">{wObj?.name || 'Pekerja'}</span>
                          {wObj?.worker_no && (
                            <span className="text-[10px] opacity-70">({wObj.worker_no})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveWorkerFromEditModal(wId)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-colors ml-1 -mr-1 inline-flex items-center justify-center min-w-[28px] min-h-[28px]"
                            title="Keluarkan pekerja"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Tambah Pekerja Lain - Stacked on Mobile, Inline on Desktop */}
                <div className="space-y-2 pt-1">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold">Tambah Pekerja Ke Tugasan Ini</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="relative flex-1">
                      <select
                        value={selectedAddWorkerId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedAddWorkerId(val);
                          if (val) {
                            handleAddWorkerToEditModal(val);
                          }
                        }}
                        className={`w-full p-3.5 pr-10 border rounded-xl outline-none font-bold text-xs cursor-pointer ${
                          isDarkMode 
                            ? 'bg-slate-800 border-white/5 text-white focus:border-emerald-500' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                        }`}
                      >
                        <option value="" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                          -- Pilih Pekerja Untuk Ditambah --
                        </option>
                        {workers
                          .filter(w => !editingWorkerIds.includes(String(w.id)))
                          .map(w => {
                            const isAssigned = assignments.some(a => String(a.worker_id || a.worker?.id) === String(w.id));
                            return (
                              <option 
                                key={String(w.id)} 
                                value={String(w.id)}
                                className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
                              >
                                {w.name} ({w.worker_no || 'Tiada No'}) {isAssigned ? '— [Tukar Tugasan]' : ''}
                              </option>
                            );
                          })
                        }
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddWorkerToEditModal()}
                      disabled={!selectedAddWorkerId}
                      className="w-full sm:w-auto px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:opacity-40 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95 shadow-md min-h-[44px]"
                    >
                      <UserPlus size={16} />
                      <span>Tambah Pekerja</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingIndices([]);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
                    isDarkMode
                      ? 'bg-slate-800 border-white/5 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Check size={14} />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
