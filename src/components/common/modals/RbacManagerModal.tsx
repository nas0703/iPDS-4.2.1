import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  RotateCcw,
  Trash2,
  Edit2,
  CheckCircle2,
  Lock,
  Layers,
  Building2,
  MapPin,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  AuthRole,
  ModuleKey,
  RoleUserConfig,
  AVAILABLE_MODULES,
  getStoredPinRegistry,
  savePinRegistryAsync,
  syncPinRegistryFromServer,
  updateUserCredential,
  updateUserCredentialAsync,
  addNewUserCredential,
  addNewUserCredentialAsync,
  deleteUserCredential,
  deleteUserCredentialAsync,
  resetPinRegistryToDefaults,
  resetPinRegistryToDefaultsAsync,
  isSuperAdmin,
  fetchPinVaultAsync,
  revealCredentialFromServerAsync,
} from "../../../features/auth/services/rbacService";

interface RbacManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string | null;
  activeEstateId?: string;
  onSaveComplete?: () => void;
}

const ESTATE_OPTIONS = [
  { id: "FPM_TUNGGAL", code: "5155", name: "5155 - LADANG FPM TUNGGAL" },
  { id: "FPM_ADELA", code: "5136", name: "5136 - LADANG FPM ADELA" },
  { id: "FPM_KLEDANG", code: "5176", name: "5176 - LADANG FPM KLEDANG" },
  { id: "FPM_SENING", code: "5156", name: "5156 - LADANG FPM SENING" },
];

const ESTATE_FILTER_OPTIONS = [
  { id: "SEMUA", code: "ALL", name: "SEMUA LADANG (Paparan Keseluruhan)" },
  ...ESTATE_OPTIONS,
];

export const RbacManagerModal: React.FC<RbacManagerModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  activeEstateId,
  onSaveComplete,
}) => {
  const [registry, setRegistry] = useState<Record<string, RoleUserConfig>>({});
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [editingPinKey, setEditingPinKey] = useState<string | null>(null);

  // Selected Estate Filter state
  const [selectedEstateFilter, setSelectedEstateFilter] = useState<string>("FPM_TUNGGAL");

  // Edit form state
  const [editForm, setEditForm] = useState<{
    oldPin: string;
    newPin: string;
    password: string;
    username: string;
    label: string;
    estate_id: string;
    role: AuthRole;
    quickAccess: boolean;
    allowedModules: ModuleKey[];
  }>({
    oldPin: "",
    newPin: "",
    password: "",
    username: "",
    label: "",
    estate_id: "FPM_TUNGGAL",
    role: "staff",
    quickAccess: false,
    allowedModules: [],
  });

  // Add new user state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newUserData, setNewUserData] = useState<{
    pin: string;
    password: string;
    username: string;
    label: string;
    estate_id: string;
    role: AuthRole;
    allowedModules: ModuleKey[];
  }>({
    pin: "",
    password: "",
    username: "",
    label: "",
    estate_id: "FPM_TUNGGAL",
    role: "staff",
    allowedModules: ["hasil", "efb"],
  });

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [liveSyncedMod, setLiveSyncedMod] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<RoleUserConfig | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "modules">("users");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [revealingKeys, setRevealingKeys] = useState<Record<string, boolean>>({});
  const [vaultCredentials, setVaultCredentials] = useState<Record<string, { pin: string; password?: string }>>({});
  const [reauthPromptUser, setReauthPromptUser] = useState<{ userKey: string; userLabel: string } | null>(null);
  const [reauthPin, setReauthPin] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isSubmittingReauth, setIsSubmittingReauth] = useState(false);

  // Only FC FPM Tunggal (Super Admin) is authorized to manage RBAC & change PINs
  const isAuthorizedSuperAdmin = isSuperAdmin(currentUserRole, activeEstateId);

  // Reload registry when modal opens or on event
  const loadRegistry = () => {
    const data = getStoredPinRegistry();
    setRegistry(data);
  };

  useEffect(() => {
    const handleUpdate = () => {
      loadRegistry();
    };
    window.addEventListener("rbac_registry_updated", handleUpdate);
    return () => {
      window.removeEventListener("rbac_registry_updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRegistry();
      syncPinRegistryFromServer().then((data) => {
        if (data) setRegistry(data);
      }).catch(() => null);

      // Enterprise Step 1: Pre-fetch secure PIN vault from server for Super Admin
      if (isAuthorizedSuperAdmin) {
        fetchPinVaultAsync().then((vault) => {
          if (vault) {
            const mapped: Record<string, { pin: string; password?: string }> = {};
            for (const [k, v] of Object.entries(vault)) {
              if (v && v.pin) {
                mapped[k] = { pin: v.pin, password: v.password || v.pin };
              }
            }
            setVaultCredentials(mapped);
          }
        }).catch(() => null);
      }

      setEditingPinKey(null);
      setIsAddingNew(false);
      setFeedback(null);
      setShowResetConfirm(false);

      if (activeEstateId) {
        if (activeEstateId === "5155" || activeEstateId === "FPM_TUNGGAL") setSelectedEstateFilter("FPM_TUNGGAL");
        else if (activeEstateId === "5136" || activeEstateId === "FPM_ADELA") setSelectedEstateFilter("FPM_ADELA");
        else if (activeEstateId === "5176" || activeEstateId === "FPM_KLEDANG") setSelectedEstateFilter("FPM_KLEDANG");
        else if (activeEstateId === "5156" || activeEstateId === "FPM_SENING") setSelectedEstateFilter("FPM_SENING");
        else setSelectedEstateFilter(activeEstateId);
      }
    }
  }, [isOpen, activeEstateId, isAuthorizedSuperAdmin]);

  if (!isOpen) return null;

  const handleConfirmReveal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reauthPromptUser || !reauthPin.trim()) return;

    const { userKey } = reauthPromptUser;
    setIsSubmittingReauth(true);
    setReauthError(null);

    try {
      const res = await revealCredentialFromServerAsync(userKey, reauthPin.trim());
      if (res && res.success && res.pin) {
        setVaultCredentials((prev) => ({
          ...prev,
          [userKey]: { pin: res.pin!, password: res.password || res.pin! },
        }));
        setRevealedPins((prev) => ({
          ...prev,
          [userKey]: true,
        }));
        setReauthPromptUser(null);
        setReauthPin("");
        setReauthError(null);
      } else {
        setReauthError(res?.error || "PIN pengesahan tidak sah");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "PIN pengesahan tidak sah";
      setReauthError(msg);
    } finally {
      setIsSubmittingReauth(false);
    }
  };

  const handleCancelReauth = () => {
    setReauthPromptUser(null);
    setReauthPin("");
    setReauthError(null);
  };

  const isUserInEstate = (user: RoleUserConfig, estateFilter: string) => {
    if (estateFilter === "SEMUA") return true;
    const uEst = (user.estate_id || "FPM_TUNGGAL").toUpperCase();
    if (estateFilter === "FPM_TUNGGAL") return uEst === "FPM_TUNGGAL" || uEst === "5155";
    if (estateFilter === "FPM_ADELA") return uEst === "FPM_ADELA" || uEst === "5136";
    if (estateFilter === "FPM_KLEDANG") return uEst === "FPM_KLEDANG" || uEst === "5176";
    if (estateFilter === "FPM_SENING") return uEst === "FPM_SENING" || uEst === "5156";
    return uEst === estateFilter.toUpperCase();
  };

  const startEditUser = (user: RoleUserConfig) => {
    // If in SEMUA mode, switch filter to this user's estate
    const userEstate = user.estate_id || "FPM_TUNGGAL";
    if (selectedEstateFilter === "SEMUA") {
      setSelectedEstateFilter(userEstate);
    }

    const userKey = user.pin || user.username || user.id || "";
    const vaultData = vaultCredentials[userKey] || vaultCredentials[user.pin] || (user.id ? vaultCredentials[user.id] : null);
    const effectivePin = vaultData?.pin || user.pin;
    const effectivePassword = vaultData?.password || user.password || user.pin;

    setEditingPinKey(user.pin);
    setEditForm({
      oldPin: user.pin,
      newPin: effectivePin,
      password: effectivePassword,
      username: user.username || effectivePin,
      label: user.label,
      estate_id: userEstate,
      role: user.role,
      quickAccess: !!user.quickAccess,
      allowedModules: [...user.allowedModules],
    });
    setIsAddingNew(false);
    setFeedback(null);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const serverData = await syncPinRegistryFromServer();
      if (serverData) {
        setRegistry(serverData);
      }
      if (isAuthorizedSuperAdmin) {
        const vault = await fetchPinVaultAsync();
        if (vault) {
          const mapped: Record<string, { pin: string; password?: string }> = {};
          for (const [k, val] of Object.entries(vault)) {
            if (val && val.pin) mapped[k] = { pin: val.pin, password: val.password || val.pin };
          }
          setVaultCredentials(mapped);
        }
      }
      setFeedback({
        type: "success",
        message: "Segerakan selesai: Senarai akses & kata laluan kini selaras sepenuhnya dengan pelayan!"
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: "Gagal berhubung dengan pelayan: " + (err?.message || "Ralat rangkaian") });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!isAuthorizedSuperAdmin) {
      setFeedback({ type: "error", message: "Akses Ditolak: Hanya Super Admin (FC FPM Tunggal) yang dibenarkan menukar PIN atau mengemaskini RBAC." });
      return;
    }

    if (!editForm.newPin || editForm.newPin.length < 6) {
      setFeedback({ type: "error", message: "Sila masukkan No. Kakitangan / Kata Laluan 6 hingga 7 digit yang sah." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await updateUserCredentialAsync(editForm.oldPin, editForm.newPin, {
        role: editForm.role,
        label: editForm.label,
        estate_id: editForm.estate_id,
        password: editForm.password,
        username: editForm.username,
        quickAccess: editForm.quickAccess,
        allowedModules: editForm.allowedModules,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Akses dan Kata Laluan untuk "${editForm.label}" berjaya dikemaskini & disegerakkan serta-merta ke pelayan!`
        });
        setEditingPinKey(null);
        loadRegistry();
        // Update local vault cache with new credentials
        setVaultCredentials((prev) => {
          const updated = { ...prev };
          if (editForm.oldPin && updated[editForm.oldPin]) delete updated[editForm.oldPin];
          updated[editForm.newPin] = {
            pin: editForm.newPin,
            password: editForm.password || editForm.newPin
          };
          return updated;
        });
        if (isAuthorizedSuperAdmin) {
          fetchPinVaultAsync().then((v) => {
            if (v) {
              const mapped: Record<string, { pin: string; password?: string }> = {};
              for (const [k, val] of Object.entries(v)) {
                if (val && val.pin) mapped[k] = { pin: val.pin, password: val.password || val.pin };
              }
              setVaultCredentials(mapped);
            }
          }).catch(() => null);
        }
        if (onSaveComplete) onSaveComplete();
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal mengemaskini maklumat pengguna." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Ralat menyimpan perubahan." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewUser = async () => {
    if (!isAuthorizedSuperAdmin) {
      setFeedback({ type: "error", message: "Akses Ditolak: Hanya Super Admin (FC FPM Tunggal) yang dibenarkan menambah akaun pengguna." });
      return;
    }

    if (!newUserData.pin || newUserData.pin.length < 6) {
      setFeedback({ type: "error", message: "No. Kakitangan / Kata Laluan mestilah 6 hingga 7 digit nombor." });
      return;
    }
    if (!newUserData.label.trim()) {
      setFeedback({ type: "error", message: "Sila masukkan nama jawatan atau nama staf." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const targetEstate = newUserData.estate_id || (selectedEstateFilter !== "SEMUA" ? selectedEstateFilter : "FPM_TUNGGAL");

    try {
      const res = await addNewUserCredentialAsync(
        newUserData.pin,
        newUserData.label,
        newUserData.role,
        newUserData.allowedModules,
        targetEstate,
        newUserData.password || newUserData.pin,
        newUserData.username || newUserData.pin
      );

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Pengguna baharu "${newUserData.label}" berjaya didaftarkan & disegerakkan serta-merta!`
        });
        setIsAddingNew(false);
        setNewUserData({
          pin: "",
          password: "",
          username: "",
          label: "",
          estate_id: selectedEstateFilter !== "SEMUA" ? selectedEstateFilter : "FPM_TUNGGAL",
          role: "staff",
          allowedModules: ["hasil", "efb"],
        });
        loadRegistry();
        if (isAuthorizedSuperAdmin) {
          fetchPinVaultAsync().then((v) => {
            if (v) {
              const mapped: Record<string, { pin: string; password?: string }> = {};
              for (const [k, val] of Object.entries(v)) {
                if (val && val.pin) mapped[k] = { pin: val.pin, password: val.password || val.pin };
              }
              setVaultCredentials(mapped);
            }
          }).catch(() => null);
        }
        if (onSaveComplete) onSaveComplete();
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal menambah pengguna." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Ralat mendaftar pengguna." });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!isAuthorizedSuperAdmin) {
      setFeedback({ type: "error", message: "Akses Ditolak: Hanya Super Admin (FC FPM Tunggal) yang dibenarkan memadam akaun pengguna." });
      return;
    }
    if (!deletingUser) return;
    const targetPin = deletingUser.pin;
    const targetLabel = deletingUser.label;

    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await deleteUserCredentialAsync(targetPin);
      if (res.success) {
        setFeedback({ type: "success", message: `Akses "${targetLabel}" (PIN: ${targetPin}) telah berjaya dipadam & disegerakkan.` });
        setDeletingUser(null);
        loadRegistry();
        if (onSaveComplete) onSaveComplete();
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal memadam pengguna." });
        setDeletingUser(null);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Ralat memadam pengguna." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!isAuthorizedSuperAdmin) {
      setFeedback({ type: "error", message: "Akses Ditolak: Hanya Super Admin (FC FPM Tunggal) yang dibenarkan menetapkan semula RBAC." });
      return;
    }
    setIsSaving(true);
    try {
      await resetPinRegistryToDefaultsAsync();
      loadRegistry();
      setShowResetConfirm(false);
      setEditingPinKey(null);
      setIsAddingNew(false);
      setFeedback({ type: "success", message: "Semua PIN dan peranan telah dikembalikan ke tetapan asal kilang & disegerakkan ke pelayan." });
      if (onSaveComplete) onSaveComplete();
    } catch (e: any) {
      setFeedback({ type: "error", message: e?.message || "Ralat mengembalikan tetapan kilang." });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModuleForEdit = async (modKey: ModuleKey) => {
    const exists = editForm.allowedModules.includes(modKey);
    const nextAllowed = exists
      ? editForm.allowedModules.filter((k) => k !== modKey)
      : [...editForm.allowedModules, modKey];

    // Update form state immediately
    setEditForm((prev) => ({
      ...prev,
      allowedModules: nextAllowed,
    }));

    // Auto-save & sync immediately to registry & broadcast event
    try {
      const cleanPin = editForm.oldPin.trim().replace(/\s+/g, "");
      const currentReg = getStoredPinRegistry();
      if (currentReg[cleanPin]) {
        currentReg[cleanPin] = {
          ...currentReg[cleanPin],
          allowedModules: nextAllowed,
          isCustom: true,
        };
        await savePinRegistryAsync(currentReg);
        // Also update local registry state so cards update immediately
        setRegistry((prev) => ({
          ...prev,
          [cleanPin]: currentReg[cleanPin],
        }));
        setLiveSyncedMod(modKey);
        setTimeout(() => setLiveSyncedMod(null), 1800);
      }
    } catch (e) {
      console.error("Auto sync module failed:", e);
    }
  };

  const handleSelectAllModulesForEdit = async () => {
    const allKeys = AVAILABLE_MODULES.map((m) => m.key);
    setEditForm((prev) => ({ ...prev, allowedModules: allKeys }));
    try {
      const cleanPin = editForm.oldPin.trim().replace(/\s+/g, "");
      const currentReg = getStoredPinRegistry();
      if (currentReg[cleanPin]) {
        currentReg[cleanPin] = {
          ...currentReg[cleanPin],
          allowedModules: allKeys,
          isCustom: true,
        };
        await savePinRegistryAsync(currentReg);
        setRegistry((prev) => ({ ...prev, [cleanPin]: currentReg[cleanPin] }));
        setLiveSyncedMod("ALL");
        setTimeout(() => setLiveSyncedMod(null), 1800);
      }
    } catch (e) {
      console.error("Select all sync failed:", e);
    }
  };

  const handleDeselectAllModulesForEdit = async () => {
    const basicOnly: ModuleKey[] = ["hasil"];
    setEditForm((prev) => ({ ...prev, allowedModules: basicOnly }));
    try {
      const cleanPin = editForm.oldPin.trim().replace(/\s+/g, "");
      const currentReg = getStoredPinRegistry();
      if (currentReg[cleanPin]) {
        currentReg[cleanPin] = {
          ...currentReg[cleanPin],
          allowedModules: basicOnly,
          isCustom: true,
        };
        await savePinRegistryAsync(currentReg);
        setRegistry((prev) => ({ ...prev, [cleanPin]: currentReg[cleanPin] }));
        setLiveSyncedMod("NONE");
        setTimeout(() => setLiveSyncedMod(null), 1800);
      }
    } catch (e) {
      console.error("Deselect all sync failed:", e);
    }
  };

  const toggleModuleForNew = (modKey: ModuleKey) => {
    setNewUserData((prev) => {
      const exists = prev.allowedModules.includes(modKey);
      return {
        ...prev,
        allowedModules: exists
          ? prev.allowedModules.filter((k) => k !== modKey)
          : [...prev.allowedModules, modKey],
      };
    });
  };

  const roleBadgeStyle = (role: AuthRole) => {
    switch (role) {
      case "rc":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "oc":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "fc":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "afc":
        return "bg-teal-500/20 text-teal-300 border-teal-500/40";
      case "fs":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "kerani_kewangan":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "kerani_stok":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "kerani_resit":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "mandur":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "eqi":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "pf":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "staff":
      default:
        return "bg-slate-700/50 text-slate-300 border-slate-600";
    }
  };

  const roleTitleMap: Record<AuthRole, string> = {
    fc: "Field Controller (FC)",
    afc: "Asst. Field Controller (AFC)",
    fs: "Field Supervisor (FS)",
    kerani_kewangan: "Kerani Kewangan",
    kerani_stok: "Kerani Stok Dan Bekalan",
    kerani_resit: "Kerani Resit",
    mandur: "Mandur",
    staff: "Kerani Operasi (Staff)",
    eqi: "Gred Sawit (EQI)",
    pf: "Pengurus Felda (PF)",
    rc: "Regional Controller (RC - Wilayah JB)",
    oc: "Operation Controller (OC - Zon Adela)",
  };

  const renderUserCard = (user: RoleUserConfig, index?: number) => {
    const isEditing = editingPinKey === user.pin;
    const userKey = user.pin || user.username || user.id || "";
    const isRevealed = !!(
      revealedPins[userKey] ||
      (user.pin && revealedPins[user.pin]) ||
      (user.id && revealedPins[user.id])
    );
    const cardKey = `user-${user.pin || "nopin"}-${user.id || "noid"}-${index ?? 0}`;

    return (
      <div
        key={cardKey}
        className={`p-3 sm:p-4 rounded-xl border transition-all ${
          isEditing
            ? "bg-slate-950/90 border-emerald-500/80 shadow-lg ring-1 ring-emerald-500/40"
            : "bg-slate-800/40 border-slate-700/70 hover:border-slate-600"
        }`}
      >
        {isEditing ? (
          /* Edit In-Place Form */
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5" />
                Kemaskini Maklumat: {user.label}
              </span>
              <button
                onClick={() => setEditingPinKey(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  Kod Ladang (Estate):
                </label>
                <select
                  value={editForm.estate_id}
                  onChange={(e) => setEditForm({ ...editForm, estate_id: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  {ESTATE_OPTIONS.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  Gelaran / Nama Staf:
                </label>
                <input
                  type="text"
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  No. Kakitangan / PIN (6-7 Digit):
                </label>
                <input
                  type="text"
                  maxLength={7}
                  value={editForm.newPin}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      newPin: e.target.value.replace(/\D/g, "").slice(0, 7),
                    })
                  }
                  placeholder="Cth: 6-7 digit PIN"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-sm tracking-widest focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  Kata Laluan Log Masuk (Password):
                </label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Cth: StaffTunggal#2026!"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs focus:border-emerald-500 focus:outline-none font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  Nama Pengguna (Username / ID Log Masuk):
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      username: e.target.value,
                    })
                  }
                  placeholder="Cth: kerani_tunggal"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  Peranan Sistem:
                </label>
                <select
                  value={editForm.role}
                  disabled={user.role === "fc"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as AuthRole })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="fc">1. Field Controller (FC)</option>
                  <option value="afc">2. Asst. Field Controller (AFC)</option>
                  <option value="fs">3. Field Supervisor (FS)</option>
                  <option value="kerani_kewangan">4. Kerani Kewangan</option>
                  <option value="kerani_stok">5. Kerani Stok Dan Bekalan</option>
                  <option value="kerani_resit">6. Kerani Resit</option>
                  <option value="mandur">7. Mandur</option>
                  <option value="staff">Kerani Operasi (Staff)</option>
                  <option value="eqi">Gred Sawit (EQI)</option>
                  <option value="pf">Pengurus Felda (PF)</option>
                </select>
              </div>
            </div>

            {/* Module Permissions Checkboxes for this user with Instant Sync */}
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Kebenaran Akses Modul ({editForm.allowedModules.length} Dibenarkan):
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Disimpan & Segerak Serta-Merta
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSelectAllModulesForEdit}
                    disabled={editForm.role === "fc"}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllModulesForEdit}
                    disabled={editForm.role === "fc"}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 cursor-pointer"
                  >
                    Padam Semua
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 max-h-40 overflow-y-auto custom-scrollbar">
                {AVAILABLE_MODULES.map((mod) => {
                  const isChecked = editForm.allowedModules.includes(mod.key);
                  const isJustSynced = liveSyncedMod === mod.key || liveSyncedMod === "ALL";
                  return (
                    <label
                      key={mod.key}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-[10px] select-none transition-all ${
                        isChecked
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-xs"
                          : "bg-slate-950/40 text-slate-400 hover:text-slate-300 border border-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={editForm.role === "fc"}
                          onChange={() => toggleModuleForEdit(mod.key)}
                          className="accent-emerald-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="font-bold tracking-wide truncate">{mod.label}</span>
                      </div>
                      {isJustSynced && (
                        <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded shrink-0">
                          ✓
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Save / Cancel action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingPinKey(null)}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isSaving ? "Menyegerakkan..." : "Simpan & Segerak"}
              </button>
            </div>
          </div>
        ) : (
          /* Normal Read Card */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-xs sm:text-sm">
                  {user.label}
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${roleBadgeStyle(
                    user.role
                  )}`}
                >
                  {roleTitleMap[user.role] || user.role.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] text-slate-300 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-medium flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-emerald-400" />
                  Kod Ladang: {ESTATE_OPTIONS.find(e => e.id === user.estate_id || e.code === user.estate_id)?.code || "5155"} ({user.estate_id === "FPM_TUNGGAL" || !user.estate_id ? "FPM Tunggal" : user.estate_id})
                </span>
                {/* Enterprise Vault: prioritize secure server credentials */}
                {(() => {
                  const userKey = user.pin || user.username || user.id || "";
                  const vaultData = vaultCredentials[userKey] || vaultCredentials[user.pin] || (user.id ? vaultCredentials[user.id] : null);
                  const effectivePin = vaultData?.pin || user.pin;
                  const effectivePassword = vaultData?.password || user.password || user.pin;
                  const isRevealing = revealingKeys[userKey] || revealingKeys[user.pin];

                  return (
                    <>
                      <div className="flex items-center gap-1 font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                        <KeyRound className="w-3 h-3 text-emerald-400" />
                        <span>PIN:</span>
                        <span className="font-bold text-emerald-400 tracking-wider">
                          {isRevealing ? (
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400 inline" />
                          ) : isRevealed ? (
                            effectivePin
                          ) : (
                            "••••••"
                          )}
                        </span>
                      </div>
                      {(effectivePassword || user.username) && (
                        <div className="flex items-center gap-1 font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                          <span className="text-amber-400 font-semibold">Kata Laluan:</span>
                          <span className="font-bold text-amber-300 tracking-wider">
                            {isRevealing ? (
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400 inline" />
                            ) : isRevealed ? (
                              effectivePassword
                            ) : (
                              "••••••"
                            )}
                          </span>
                        </div>
                      )}
                      {user.username && user.username !== user.pin && (
                        <div className="flex items-center gap-1 font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                          <span className="text-slate-400">ID:</span>
                          <span className="text-slate-200">{user.username}</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (isRevealed) {
                            setRevealedPins((prev) => ({
                              ...prev,
                              [userKey]: false,
                              ...(user.pin ? { [user.pin]: false } : {}),
                              ...(user.id ? { [user.id]: false } : {}),
                            }));
                          } else {
                            setReauthPromptUser({
                              userKey,
                              userLabel: user.label || user.username || userKey,
                            });
                            setReauthPin("");
                            setReauthError(null);
                          }
                        }}
                        className="text-slate-500 hover:text-slate-300 ml-1 p-0.5 cursor-pointer flex items-center gap-1 text-[10px]"
                        title={isRevealed ? "Sembunyikan Kata Laluan" : "Papar Kata Laluan"}
                      >
                        {isRevealed ? (
                          <>
                            <EyeOff className="w-3 h-3 text-amber-400" />
                            <span className="text-amber-400">Tutup</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Lihat</span>
                          </>
                        )}
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Allowed Modules Badges on card */}
              <div className="flex items-center gap-1 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-semibold">Akses Modul:</span>
                {user.allowedModules && user.allowedModules.length > 0 ? (
                  user.allowedModules.map((modKey) => {
                    const modDef = AVAILABLE_MODULES.find((m) => m.key === modKey);
                    return (
                      <span
                        key={modKey}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 tracking-tight"
                      >
                        {modDef?.label || modKey.toUpperCase()}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-slate-500 italic">Tiada modul dibenarkan</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => startEditUser(user)}
                className="py-1.5 px-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-600/60"
              >
                <Edit2 className="w-3 h-3 text-emerald-400" />
                <span>Tukar Kata Laluan / Akses</span>
              </button>

              {(() => {
                const isPrimaryFC = user.role === "fc" && Object.values(registry).filter((u: any) => u && (u as any).role === "fc").length <= 1;
                return (
                  <button
                    onClick={() => !isPrimaryFC && setDeletingUser(user)}
                    disabled={isPrimaryFC}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isPrimaryFC
                        ? "text-slate-600 bg-slate-800/30 cursor-not-allowed opacity-40 border border-slate-800"
                        : "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/40 active:scale-95"
                    }`}
                    title={isPrimaryFC ? "Akaun Field Controller utama tidak boleh dipadam" : `Padam Akses ${user.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Pengurusan PIN & Kawalan Akses (RBAC)
                </h3>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  FC Admin Sahaja
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tukar kata laluan PIN 6-digit dan tetapkan kebenaran modul peranan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => {
              setActiveTab("users");
              setEditingPinKey(null);
              setIsAddingNew(false);
            }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "users"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Senarai Pengguna & PIN ({Object.keys(registry).length})
          </button>
          <button
            onClick={() => setActiveTab("modules")}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "modules"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Matriks Kebenaran Modul
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {!isAuthorizedSuperAdmin ? (
            <div className="py-12 px-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Akses Terhad (Super Admin Sahaja)</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Hanya <strong>Super Admin (Field Controller FC FPM Tunggal)</strong> yang dibenarkan untuk mengakses dan menguruskan tetapan Kod Ladang, No. Kakitangan (Kata Laluan), dan Kawalan Akses (RBAC) dalam sistem ini. Pengguna bagi akaun ladang lain (seperti FC Kledang, FC Adela, FC Sening) tidak dibenarkan mengubah sebarang akses.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Tutup Modul
              </button>
            </div>
          ) : (
            <>
              {/* Feedback message banner */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    feedback.type === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                  <button
                    onClick={() => setFeedback(null)}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Informational Guidance Banner */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-300 block">
                    Pengurusan Kata Laluan & Log Masuk Kiosk
                  </span>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Admin boleh menetapkan <strong>Kod Ladang</strong> dan <strong>No. Kakitangan (Kata Laluan)</strong> bagi setiap pengguna.
                    Pengguna boleh terus log masuk di skrin Kiosk dengan memasukkan Kod Ladang & No. Kakitangan yang ditetapkan di sini.
                  </p>
                </div>
              </div>

              {activeTab === "users" ? (
                <>
                  {/* Estate Dropdown Selector */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-950/90 border-2 border-emerald-500/50 shadow-lg space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white block">
                            Pilih Ladang (Estate):
                          </label>
                          <span className="text-[10px] text-slate-400 block">
                            Asingkan senarai kakitangan & tukar kata laluan mengikut ladang
                          </span>
                        </div>
                      </div>

                      <select
                        value={selectedEstateFilter}
                        onChange={(e) => {
                          const selected = e.target.value;
                          setSelectedEstateFilter(selected);
                          setEditingPinKey(null);
                          setIsAddingNew(false);
                          setFeedback(null);
                          if (selected !== "SEMUA") {
                            setNewUserData((prev) => ({ ...prev, estate_id: selected }));
                          }
                        }}
                        className="w-full sm:w-72 px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/60 text-emerald-300 font-bold text-xs shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                      >
                        {ESTATE_FILTER_OPTIONS.map((est) => (
                          <option key={est.id} value={est.id} className="bg-slate-900 text-white font-semibold">
                            {est.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div className="flex items-center gap-2">
                        {selectedEstateFilter === "SEMUA" ? (
                          <span className="text-amber-300 font-medium flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-amber-400" />
                            Paparan Keseluruhan: Semua Ladang Dipaparkan
                          </span>
                        ) : (
                          <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Ladang Terpilih: {ESTATE_OPTIONS.find((e) => e.id === selectedEstateFilter)?.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleManualSync}
                          disabled={isSyncing}
                          className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 cursor-pointer shadow-sm"
                          title="Segerakkan senarai pengguna & kata laluan dengan pelayan serta-merta"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
                          <span>{isSyncing ? "Menyegerak..." : "Segerak Pelayan"}</span>
                        </button>
                        <button
                          onClick={() => {
                            if (selectedEstateFilter === "SEMUA") {
                              setSelectedEstateFilter("FPM_TUNGGAL");
                              setNewUserData((prev) => ({ ...prev, estate_id: "FPM_TUNGGAL" }));
                            }
                            setIsAddingNew(!isAddingNew);
                            setEditingPinKey(null);
                            setFeedback(null);
                          }}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>
                            Tambah Pengguna Baharu {selectedEstateFilter !== "SEMUA" ? `(${ESTATE_OPTIONS.find(e => e.id === selectedEstateFilter)?.code})` : ""}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Guidance Notice if SEMUA is selected */}
                  {selectedEstateFilter === "SEMUA" && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Sila pilih ladang spesifik daripada dropdown di atas untuk menambah atau mengemaskini No. Kakitangan (Kata Laluan) bagi ladang tersebut.
                      </span>
                    </div>
                  )}

                  {/* Add New User Accordion Form */}
                  {isAddingNew && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Daftar Pengguna / Staf Baharu ({ESTATE_OPTIONS.find(e => e.id === newUserData.estate_id)?.name})
                        </h4>
                        <button
                          onClick={() => setIsAddingNew(false)}
                          className="text-slate-400 hover:text-white text-xs cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Kod Ladang (Estate):
                          </label>
                          <select
                            value={newUserData.estate_id}
                            onChange={(e) => setNewUserData({ ...newUserData, estate_id: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            {ESTATE_OPTIONS.map((est) => (
                              <option key={est.id} value={est.id}>
                                {est.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Nama / Gelaran Staf:
                          </label>
                          <input
                            type="text"
                            placeholder="Cth: Mandur Ahmad / Kerani Zon B"
                            value={newUserData.label}
                            onChange={(e) => setNewUserData({ ...newUserData, label: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            No. Kakitangan / PIN (6-7 digit):
                          </label>
                          <input
                            type="text"
                            maxLength={7}
                            placeholder="6-7 digit nombor"
                            value={newUserData.pin}
                            onChange={(e) =>
                              setNewUserData({
                                ...newUserData,
                                pin: e.target.value.replace(/\D/g, "").slice(0, 7),
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-sm tracking-widest focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Kata Laluan Log Masuk (Password):
                          </label>
                          <input
                            type="text"
                            placeholder="Cth: StaffBaru#2026!"
                            value={newUserData.password}
                            onChange={(e) =>
                              setNewUserData({
                                ...newUserData,
                                password: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Nama Pengguna (Username / ID):
                          </label>
                          <input
                            type="text"
                            placeholder="Cth: staf_baru"
                            value={newUserData.username}
                            onChange={(e) =>
                              setNewUserData({
                                ...newUserData,
                                username: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Peranan Sistem:
                          </label>
                          <select
                            value={newUserData.role}
                            onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as AuthRole })}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="fc">1. Field Controller (FC)</option>
                            <option value="afc">2. Asst. Field Controller (AFC)</option>
                            <option value="fs">3. Field Supervisor (FS)</option>
                            <option value="kerani_kewangan">4. Kerani Kewangan</option>
                            <option value="kerani_stok">5. Kerani Stok Dan Bekalan</option>
                            <option value="kerani_resit">6. Kerani Resit</option>
                            <option value="mandur">7. Mandur</option>
                            <option value="staff">Kerani Operasi (Staff)</option>
                            <option value="eqi">Gred Sawit (EQI)</option>
                            <option value="pf">Pengurus Felda (PF)</option>
                          </select>
                        </div>
                      </div>

                      {/* Module Permissions Checkboxes for New User */}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                          Pilihan Modul Dibenarkan ({newUserData.allowedModules.length} Dibenarkan):
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 max-h-36 overflow-y-auto custom-scrollbar">
                          {AVAILABLE_MODULES.map((mod) => {
                            const isChecked = newUserData.allowedModules.includes(mod.key);
                            return (
                              <label
                                key={mod.key}
                                className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer text-[10px] select-none ${
                                  isChecked
                                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-950/40 text-slate-400 hover:text-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleModuleForNew(mod.key)}
                                  className="accent-emerald-500 w-3 h-3 cursor-pointer"
                                />
                                <span className="truncate font-medium">{mod.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={handleAddNewUser}
                          disabled={isSaving}
                          className="py-2 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {isSaving ? "Mendaftar & Menyegerakkan..." : "Simpan Pengguna Baharu"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Users List - Grouped or Filtered */}
                  <div className="space-y-4">
                    {selectedEstateFilter !== "SEMUA" ? (
                      /* Filtered Single Estate View */
                      <div className="space-y-2.5">
                        {((Object.values(registry) as RoleUserConfig[]).filter((u) =>
                          isUserInEstate(u, selectedEstateFilter)
                        )).length === 0 ? (
                          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
                            <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
                            <p className="text-xs text-slate-400 font-medium">
                              Tiada kakitangan berdaftar untuk ladang ini lagi.
                            </p>
                            <button
                              onClick={() => setIsAddingNew(true)}
                              className="text-xs text-emerald-400 hover:underline font-bold"
                            >
                              + Tambah Kakitangan Baharu
                            </button>
                          </div>
                        ) : (
                          (Object.values(registry) as RoleUserConfig[])
                            .filter((u) => isUserInEstate(u, selectedEstateFilter))
                            .map((user, idx) => renderUserCard(user, idx))
                        )}
                      </div>
                    ) : (
                      /* Grouped By Estate View for "SEMUA" */
                      ESTATE_OPTIONS.map((est) => {
                        const estUsers = (Object.values(registry) as RoleUserConfig[]).filter((u) =>
                          isUserInEstate(u, est.id)
                        );

                        return (
                          <div key={est.id} className="space-y-2.5">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                <span className="font-bold text-xs text-white">{est.name}</span>
                                <span className="text-[10px] bg-slate-800 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                                  {estUsers.length} Pengguna
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedEstateFilter(est.id);
                                  setNewUserData((prev) => ({ ...prev, estate_id: est.id }));
                                }}
                                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all"
                              >
                                <span>Pilih & Urus Ladang Ini</span>
                                <span>→</span>
                              </button>
                            </div>

                            <div className="space-y-2 pl-2 border-l-2 border-slate-800/80">
                              {estUsers.length === 0 ? (
                                <p className="text-[11px] text-slate-500 italic py-1 pl-2">
                                  Tiada kakitangan berdaftar untuk ladang ini.
                                </p>
                              ) : (
                                estUsers.map((user, idx) => renderUserCard(user, idx))
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                /* Module Matrix Tab */
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Papar ringkasan modul sistem yang boleh diakses oleh setiap peranan di FPM Tunggal.
                  </p>

                  <div className="border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Nama Modul</th>
                          <th className="p-2 text-center">FC</th>
                          <th className="p-2 text-center">AFC</th>
                          <th className="p-2 text-center">FS</th>
                          <th className="p-2 text-center whitespace-nowrap">K. Kew</th>
                          <th className="p-2 text-center whitespace-nowrap">K. Stok</th>
                          <th className="p-2 text-center whitespace-nowrap">K. Resit</th>
                          <th className="p-2 text-center">Mandur</th>
                          <th className="p-2 text-center">Staff</th>
                          <th className="p-2 text-center">EQI</th>
                          <th className="p-2 text-center">PF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {AVAILABLE_MODULES.map((mod) => (
                          <tr key={mod.key} className="hover:bg-slate-800/30">
                            <td className="p-2.5">
                              <div className="font-bold text-white tracking-wide">{mod.label}</div>
                              <div className="text-[10px] text-slate-500">{mod.description}</div>
                            </td>
                            {(["fc", "afc", "fs", "kerani_kewangan", "kerani_stok", "kerani_resit", "mandur", "staff", "eqi", "pf"] as AuthRole[]).map((role) => {
                              const userWithRole = (Object.values(registry) as RoleUserConfig[]).find((u) => u.role === role);
                              const hasAccess =
                                role === "fc" ||
                                (userWithRole && userWithRole.allowedModules.includes(mod.key));

                              return (
                                <td key={role} className="p-2 text-center">
                                  {hasAccess ? (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/60 text-slate-600 text-xs">
                                      ✕
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reset to Factory Defaults Safety Box */}
          <div className="pt-3 border-t border-slate-800">
            {showResetConfirm ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Adakah anda pasti? Semua PIN dan peranan akan diset semula ke nombor asal kilang.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleResetToDefaults}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Ya, Set Semula Asal
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembalikan Semua PIN & Akses Ke Tetapan Asal (Factory Reset)</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            PIN & Peranan berkuat kuasa serta-merta
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Custom Confirmation Modal for Deleting User */}
      {deletingUser && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Sahkan Padam Pengguna</h3>
                <p className="text-[11px] text-slate-400">
                  Adakah anda pasti mahu memadamkan akaun dan akses pengguna ini?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Gelaran / Nama Staf:</span>
                <span className="font-bold text-white text-right">{deletingUser.label}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">No. Kakitangan / PIN:</span>
                <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  {deletingUser.pin}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Kod Ladang:</span>
                <span className="font-semibold text-slate-300">
                  {ESTATE_OPTIONS.find(e => e.id === deletingUser.estate_id || e.code === deletingUser.estate_id)?.name || deletingUser.estate_id || "FPM Tunggal"}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Pengguna ini tidak lagi boleh log masuk selepas dipadam. Anda boleh menambahnya semula bila-bila masa.</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Padam Akses</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Re-authenticating Admin on Reveal */}
      {reauthPromptUser && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Pengesahan Semula Pentadbir</h3>
                <p className="text-[11px] text-slate-400">
                  Masukkan PIN Super Admin anda untuk mengesahkan identiti dan memaparkan kredensial staf ini.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Staf / Pengguna:</span>
                <span className="font-bold text-white text-right">{reauthPromptUser.userLabel}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmReveal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  PIN Super Admin (Pengesahan)
                </label>
                <input
                  type="password"
                  autoFocus
                  placeholder="Masukkan PIN Super Admin anda"
                  value={reauthPin}
                  onChange={(e) => {
                    setReauthPin(e.target.value);
                    if (reauthError) setReauthError(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {reauthError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{reauthError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelReauth}
                  disabled={isSubmittingReauth}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!reauthPin.trim() || isSubmittingReauth}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {isSubmittingReauth ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengesahkan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Sahkan & Papar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RbacManagerModal;
