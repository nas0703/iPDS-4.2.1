import { getActiveEstateId } from "../../../utils/estateContext";
import { normalizeEstateId } from "../../../config/estateRegistry";
import { safeFetch } from "../../../utils/safeFetch";

export type AuthRole =
  | "staff"
  | "mandur"
  | "fc"
  | "afc"
  | "fs"
  | "pf"
  | "eqi"
  | "oc"
  | "rc"
  | "kerani_kewangan"
  | "kerani_stok"
  | "kerani_resit";

export type ModuleKey =
  | "dashboard"
  | "hasil"
  | "kualiti"
  | "fertilizer"
  | "merumput"
  | "pruning"
  | "pekerja"
  | "efb"
  | "harga"
  | "kpi_staff"
  | "hujan"
  | "sejarah"
  | "ai_executive"
  | "export"
  | "settings";

export interface RoleUserConfig {
  id: string;
  pin?: string;
  role: AuthRole;
  label: string;
  estate_id: string;
  password?: string;
  username?: string;
  email?: string;
  quickAccess?: boolean;
  allowedModules: ModuleKey[];
  isCustom?: boolean;
}

export const AVAILABLE_MODULES: {
  key: ModuleKey;
  label: string;
  description: string;
  category: "Utama" | "Operasi" | "Agronomi" | "Kualiti" | "Kewangan" | "Pengurusan";
}[] = [
  { key: "hasil", label: "HASIL", description: "Borang timbangan & rekod hantaran buah sawit (BTS)", category: "Operasi" },
  { key: "kualiti", label: "KUALITI", description: "Pemeriksaan mutu buah sawit & penggredan (EQI / Kualiti BTS)", category: "Kualiti" },
  { key: "fertilizer", label: "MEMBAJA", description: "Program pembajaan pokok sawit & stok inventori baja", category: "Agronomi" },
  { key: "merumput", label: "MERUMPUT", description: "Kawalan rumpai & semburan lorong/bulatan ladang", category: "Agronomi" },
  { key: "pruning", label: "PRUNING", description: "Penyelenggaraan pelepah & cantasan pokok sawit", category: "Agronomi" },
  { key: "pekerja", label: "PEKERJA", description: "Muster chit, kehadiran pekerja & agihan tugas", category: "Operasi" },
  { key: "efb", label: "EFB", description: "Rekod timbangan & penghantaran tandan kosong", category: "Operasi" },
  { key: "harga", label: "HARGA BTS", description: "Pantauan harga pasaran buah tandan segar semasa", category: "Kewangan" },
  { key: "kpi_staff", label: "KPI STAFF", description: "Penilaian prestasi & laporan KPI staf eksekutif", category: "Pengurusan" },
  { key: "hujan", label: "TABURAN HUJAN", description: "Rekod tolok hujan harian ladang", category: "Agronomi" },
  { key: "dashboard", label: "DASHBOARD", description: "Paparan status harian, graf hasil & ringkasan", category: "Utama" },
  { key: "sejarah", label: "SEJARAH", description: "Semakan rekod transaksi terdahulu & pengesahan", category: "Operasi" },
  { key: "ai_executive", label: "AI EXECUTIVE", description: "Analisis pintar AI, taklimat pagi & ramalan", category: "Pengurusan" },
  { key: "export", label: "EKSPORT", description: "Muat turun data ke PDF, Excel & cetakan laporan", category: "Pengurusan" },
  { key: "settings", label: "TETAPAN", description: "Kawalan keselamatan, kebenaran modul & peranti", category: "Pengurusan" },
];

export const DEFAULT_ROLE_METADATA: Record<string, RoleUserConfig> = {
  // ==========================================
  // 1. REGIONAL & OPERATION CONTROLLERS
  // ==========================================
  role_rc: {
    id: "role_rc",
    role: "rc",
    label: "Regional Controller (RC - Wilayah JB)",
    estate_id: "WILAYAH_JB",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export", "settings"],
  },
  role_oc: {
    id: "role_oc",
    role: "oc",
    label: "Operation Controller (OC - Zon Adela)",
    estate_id: "WILAYAH_JB",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export", "settings"],
  },

  // ==========================================
  // 2. FPM TUNGGAL
  // ==========================================
  role_fc_nasruddin: {
    id: "role_fc_nasruddin",
    role: "fc",
    label: "MD NASRUDDIN BIN BHSERAN (FC Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export", "settings"],
  },
  role_fc_tgl: {
    id: "role_fc_tgl",
    role: "fc",
    label: "Field Controller (FC Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export", "settings"],
  },
  role_pf_tgl: {
    id: "role_pf_tgl",
    role: "pf",
    label: "Pengurus Felda (PF Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_afc_tgl: {
    id: "role_afc_tgl",
    role: "afc",
    label: "Assistant FC (AFC Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "export"],
  },
  role_fs_tgl: {
    id: "role_fs_tgl",
    role: "fs",
    label: "Supervisor (FS Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "fertilizer", "merumput", "hujan"],
  },
  role_staff_tgl: {
    id: "role_staff_tgl",
    role: "staff",
    label: "Kerani Operasi (Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["hasil", "efb"],
  },
  role_mandur_tgl: {
    id: "role_mandur_tgl",
    role: "staff",
    label: "Mandur Penuaian (Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["hasil", "pekerja"],
  },
  role_eqi_tgl: {
    id: "role_eqi_tgl",
    role: "eqi",
    label: "Gred Sawit (EQI Tunggal)",
    estate_id: "FPM_TUNGGAL",
    quickAccess: false,
    allowedModules: ["dashboard", "kualiti", "sejarah"],
  },

  // ==========================================
  // 3. FPM ADELA
  // ==========================================
  role_fc_adl: {
    id: "role_fc_adl",
    role: "fc",
    label: "Field Controller (FC Adela)",
    estate_id: "FPM_ADELA",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_pf_adl: {
    id: "role_pf_adl",
    role: "pf",
    label: "Pengurus Felda (PF Adela)",
    estate_id: "FPM_ADELA",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_staff_adl: {
    id: "role_staff_adl",
    role: "staff",
    label: "Kerani Operasi (Adela)",
    estate_id: "FPM_ADELA",
    quickAccess: false,
    allowedModules: ["hasil", "efb"],
  },
  role_afc_adl: {
    id: "role_afc_adl",
    role: "afc",
    label: "Assistant FC (AFC Adela)",
    estate_id: "FPM_ADELA",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "export"],
  },
  role_fs_adl: {
    id: "role_fs_adl",
    role: "fs",
    label: "Supervisor (FS Adela)",
    estate_id: "FPM_ADELA",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "fertilizer", "merumput", "hujan"],
  },

  // ==========================================
  // 4. FPM KLEDANG
  // ==========================================
  role_fc_kld: {
    id: "role_fc_kld",
    role: "fc",
    label: "Field Controller (FC Kledang)",
    estate_id: "FPM_KLEDANG",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_pf_kld: {
    id: "role_pf_kld",
    role: "pf",
    label: "Pengurus Felda (PF Kledang)",
    estate_id: "FPM_KLEDANG",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_staff_kld: {
    id: "role_staff_kld",
    role: "staff",
    label: "Kerani Operasi (Kledang)",
    estate_id: "FPM_KLEDANG",
    quickAccess: false,
    allowedModules: ["hasil", "efb"],
  },
  role_afc_kld: {
    id: "role_afc_kld",
    role: "afc",
    label: "Assistant FC (AFC Kledang)",
    estate_id: "FPM_KLEDANG",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "export"],
  },
  role_fs_kld: {
    id: "role_fs_kld",
    role: "fs",
    label: "Supervisor (FS Kledang)",
    estate_id: "FPM_KLEDANG",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "fertilizer", "merumput", "hujan"],
  },

  // ==========================================
  // 5. FPM SENING
  // ==========================================
  role_fc_sng: {
    id: "role_fc_sng",
    role: "fc",
    label: "Field Controller (FC Sening)",
    estate_id: "FPM_SENING",
    quickAccess: true,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_pf_sng: {
    id: "role_pf_sng",
    role: "pf",
    label: "Pengurus Felda (PF Sening)",
    estate_id: "FPM_SENING",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "ai_executive", "export"],
  },
  role_staff_sng: {
    id: "role_staff_sng",
    role: "staff",
    label: "Kerani Operasi (Sening)",
    estate_id: "FPM_SENING",
    quickAccess: false,
    allowedModules: ["hasil", "efb"],
  },
  role_afc_sng: {
    id: "role_afc_sng",
    role: "afc",
    label: "Assistant FC (AFC Sening)",
    estate_id: "FPM_SENING",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "kualiti", "fertilizer", "merumput", "hujan", "export"],
  },
  role_fs_sng: {
    id: "role_fs_sng",
    role: "fs",
    label: "Supervisor (FS Sening)",
    estate_id: "FPM_SENING",
    quickAccess: false,
    allowedModules: ["dashboard", "hasil", "pekerja", "sejarah", "fertilizer", "merumput", "hujan"],
  }
};

export const DEFAULT_PIN_REGISTRY: Record<string, RoleUserConfig> = DEFAULT_ROLE_METADATA;

const STORAGE_KEY = "fpm_rbac_registry_v2";
const LEGACY_STORAGE_KEY = "fpm_rbac_registry_v1";

/**
 * Get current configured PIN registry from localStorage or defaults
 */
/**
 * Sanitize registry: ensure valid estates, remove duplicates, and ensure strictly unique user IDs
 */
export function sanitizePinRegistry(registry: Record<string, RoleUserConfig>): Record<string, RoleUserConfig> {
  const seenIds = new Set<string>();
  const sanitized: Record<string, RoleUserConfig> = {};

  for (const [key, user] of Object.entries(registry)) {
    if (!user || typeof user !== "object") continue;
    const cleanKey = (user.id || user.username || user.pin || key || "").trim().replace(/\s+/g, "");
    if (!cleanKey) continue;

    const u: RoleUserConfig = { ...user };
    if (!u.id) u.id = cleanKey;

    // Ensure estate_id is valid and normalized
    if (!u.estate_id || typeof u.estate_id !== "string") {
      u.estate_id = DEFAULT_ROLE_METADATA[cleanKey]?.estate_id || "FPM_TUNGGAL";
    }
    u.estate_id = normalizeEstateId(u.estate_id);

    // Ensure Kerani Operasi (staff) defaults reflect only ["hasil", "efb"]
    if (
      u.role === "staff" &&
      u.label?.includes("Kerani Operasi") &&
      !u.isCustom
    ) {
      u.allowedModules = ["hasil", "efb"];
    }

    // Ensure FC non-Tunggal accounts do not have "settings"
    if (
      u.role === "fc" &&
      u.estate_id !== "FPM_TUNGGAL" &&
      u.estate_id !== "5155"
    ) {
      u.allowedModules = (u.allowedModules || []).filter(
        (m: string) => m !== "settings"
      );
    }

    // Ensure each user has a strictly UNIQUE ID to prevent duplicate React key errors (e.g. role_afc_tgl)
    if (!u.id) {
      u.id = `role_${u.role || "user"}_${cleanKey}`;
    } else if (seenIds.has(u.id)) {
      u.id = `${u.id}_${cleanKey}`;
    }
    seenIds.add(u.id);

    sanitized[cleanKey] = u;
  }

  return sanitized;
}

/**
 * Retrieve synchronized PIN registry from localStorage or fallback to defaults
 */
export function getStoredPinRegistry(): Record<string, RoleUserConfig> {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
      }
    }
    if (!raw) return sanitizePinRegistry({ ...DEFAULT_PIN_REGISTRY });
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      const sanitized = sanitizePinRegistry(parsed);
      return sanitized;
    }
  } catch (e) {
    console.warn("Failed to load RBAC registry from storage, using defaults:", e);
  }
  return sanitizePinRegistry({ ...DEFAULT_PIN_REGISTRY });
}

/**
 * Save updated PIN registry to localStorage and server API
 */
export async function savePinRegistryAsync(registry: Record<string, RoleUserConfig>): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRegistry = sanitizePinRegistry(registry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanRegistry));
    // Trigger storage event for other components in same window
    window.dispatchEvent(new Event("rbac_registry_updated"));
    
    // Immediate background sync to server API
    try {
      const token = typeof window !== "undefined" ? (sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token")) : null;
      const lastPin = typeof window !== "undefined" ? localStorage.getItem("ipds_last_pin") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (lastPin) {
        headers["x-auth-pin"] = lastPin;
      }
      const res = await safeFetch("/api/settings/rbac", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ registry: cleanRegistry }),
      }).catch(async () => {
        return safeFetch("/api/rbac", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ registry: cleanRegistry }),
        }).catch(() => null);
      });

      if (res && res.ok) {
        console.log("[RBAC] Registry synced successfully to server.");
      }
    } catch (netErr) {
      console.warn("[RBAC] Server sync warning (local cache preserved):", netErr);
    }

    return { success: true };
  } catch (e: unknown) {
    console.error("Failed to save RBAC registry:", e);
    const errorMsg = e instanceof Error ? e.message : "Ralat menyimpan registry ke peranti.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Synchronous wrapper for savePinRegistry
 */
export function savePinRegistry(registry: Record<string, RoleUserConfig>): boolean {
  savePinRegistryAsync(registry).catch((e) => console.warn("Background save notice:", e));
  return true;
}

/**
 * Fetch and merge RBAC registry from backend / Supabase
 */
export async function syncPinRegistryFromServer(): Promise<Record<string, RoleUserConfig> | null> {
  try {
    const token = typeof window !== "undefined" ? (sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token")) : null;
    const lastPin = typeof window !== "undefined" ? localStorage.getItem("ipds_last_pin") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (lastPin) headers["x-auth-pin"] = lastPin;

    let res = await safeFetch("/api/settings/rbac", {
      method: "GET",
      headers,
      credentials: "include"
    }).catch(() => null);

    if (!res || !res.ok) {
      res = await safeFetch("/api/rbac", {
        method: "GET",
        headers,
        credentials: "include"
      }).catch(() => null);
    }

    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.registry && typeof json.registry === "object" && Object.keys(json.registry).length > 0) {
        const current = getStoredPinRegistry();

        // Avoid resurrecting default PINs if that role ID has already been migrated to a new PIN in current or server registry
        const activeRoleIds = new Set<string>();
        for (const u of Object.values(current)) {
          if (u?.id) activeRoleIds.add(u.id);
        }
        for (const u of Object.values(json.registry as Record<string, RoleUserConfig>)) {
          if (u?.id) activeRoleIds.add(u.id);
        }

        const effectiveDefaults: Record<string, RoleUserConfig> = {};
        for (const [defPin, defUser] of Object.entries(DEFAULT_PIN_REGISTRY)) {
          if (defUser.id && activeRoleIds.has(defUser.id) && !current[defPin] && !json.registry[defPin]) {
            continue;
          }
          effectiveDefaults[defPin] = defUser;
        }

        const merged: Record<string, RoleUserConfig> = sanitizePinRegistry({
          ...effectiveDefaults,
          ...current,
          ...json.registry,
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event("rbac_registry_updated"));
        return merged;
      }
    }
  } catch (err) {
    console.warn("Failed to sync RBAC registry from server:", err);
  }
  return null;
}

// Automatically initiate background sync on module load if in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncPinRegistryFromServer().catch(() => null);
  }, 1000);
}

/**
 * Enterprise Vault: Fetch full decrypted credentials directly from server for Super Admin inspection
 */
export async function fetchPinVaultAsync(): Promise<Record<string, { pin: string; password?: string; operator_name?: string }> | null> {
  try {
    const token = typeof window !== "undefined" ? (sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token")) : null;
    const lastPin = typeof window !== "undefined" ? localStorage.getItem("ipds_last_pin") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (lastPin) headers["x-auth-pin"] = lastPin;

    const res = await safeFetch("/api/auth/super-admin/pin-vault", {
      method: "GET",
      headers,
      credentials: "include"
    }).catch(() => null);

    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.vault) {
        return json.vault;
      }
    }
  } catch (err) {
    console.warn("[RBAC_VAULT] Failed to load PIN vault from server:", err);
  }
  return null;
}

/**
 * Enterprise Vault: Fetch single credential decrypt on demand from server for Super Admin
 */
export async function revealCredentialFromServerAsync(
  key: string,
  adminChallenge: string
): Promise<{ success: boolean; pin?: string; password?: string; error?: string }> {
  try {
    const token = typeof window !== "undefined" ? (sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token")) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await safeFetch("/api/auth/super-admin/reveal-credential", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ key, adminChallenge })
    }).catch(() => null);

    if (res) {
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.success) {
          const sec = json.userSecret || json.secretInfo;
          const maskedPin = sec?.pin || json.maskedPin || json.owner?.maskedPin || "";
          return {
            success: true,
            pin: maskedPin,
            password: sec?.password || maskedPin
          };
        }
      } else if (res.status === 403) {
        return { success: false, error: "PIN pengesahan tidak sah" };
      } else {
        const json = await res.json().catch(() => null);
        return { success: false, error: json?.error || "Gagal mengesahkan permintaan" };
      }
    }
  } catch (err) {
    console.warn("[RBAC_VAULT] Failed to reveal credential from server:", err);
  }
  return { success: false, error: "Ralat sambungan pelayan" };
}

const SUPER_ADMIN_ROLE_ALIASES = ["superadmin", "super_admin", "admin"];
const FC_TUNGGAL_PRIMARY_ESTATES = ["FPM_TUNGGAL", "5155"];

/**
 * Check if the user is Super Admin / Admin (Field Controller FC FPM Tunggal)
 * Peraturan Teras: FC Tunggal, Admin, dan Super Admin adalah orang yang sama.
 * Mempunyai autoriti penuh ke atas pengurusan peranti, notifikasi kelulusan,
 * pertukaran PIN, dan RBAC merentasi semua ladang.
 *
 * Canonical definition (aligned with the server SSOT isSuperAdminIdentity):
 *   - superadmin | super_admin | admin aliases, OR
 *   - the FC Tunggal of the primary estate (FPM_TUNGGAL / 5155), OR
 *   - session confirmed is_super_admin by server.
 * RC / OC / PF and branch-FC are NOT Super Admin.
 *
 * `estateId` is the user's HOME/assigned estate (not the UI-selected estate);
 * it is only consulted when the browser session context is unavailable.
 */
export function isSuperAdmin(role?: string | null, estateId?: string | null): boolean {
  if (typeof window !== "undefined") {
    try {
      const serverConfirmed = (
        sessionStorage.getItem("ipds_is_super_admin") === "true" ||
        localStorage.getItem("ipds_is_super_admin") === "true"
      );
      if (serverConfirmed) {
        return true;
      }
    } catch (_) {}
  }

  const activeRole = (
    role ||
    (typeof window !== "undefined" ? sessionStorage.getItem("ipds_auth_role") : null) ||
    ""
  ).toLowerCase().trim();

  // 1. Peranan alias Super Admin (admin, superadmin, super_admin).
  //    RC/OC bukan Super Admin: RC ialah rentas ladang dan OC/PF terhad kepada Zon Adela.
  if (SUPER_ADMIN_ROLE_ALIASES.includes(activeRole)) {
    return true;
  }

  // 2. Hanya FC Tunggal (ladang utama) ialah Super Admin. FC cawangan lain TIDAK.
  if (activeRole !== "fc") {
    return false;
  }

  if (typeof window !== "undefined") {
    try {
      const storedUserEstate = (
        localStorage.getItem("ipds_user_estate") ||
        sessionStorage.getItem("ipds_user_estate")
      );
      if (storedUserEstate) {
        const norm = normalizeEstateId(storedUserEstate);
        return FC_TUNGGAL_PRIMARY_ESTATES.includes(norm);
      }
    } catch (_) {}
  }

  // 3. Fallback kepada konteks ladang asal yang diberikan pemanggil.
  if (estateId) {
    const norm = normalizeEstateId(estateId);
    return FC_TUNGGAL_PRIMARY_ESTATES.includes(norm);
  }

  // Tiada fallback default-true: FC yang tidak dapat dikenal pasti bukan Super Admin.
  return false;
}

/**
 * Peraturan Teras: FC Tunggal, Admin, dan Super Admin adalah entiti/individu yang sama.
 */
export const isFCTunggalOrAdmin = isSuperAdmin;

/**
 * Update user PIN, password, username and optionally role, label, and allowed modules
 */
export function updateUserCredential(
  oldPin: string,
  newPin: string,
  updates: {
    role?: AuthRole;
    label?: string;
    estate_id?: string;
    password?: string;
    username?: string;
    email?: string;
    quickAccess?: boolean;
    allowedModules?: ModuleKey[];
  }
): { success: boolean; error?: string } {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan menukar PIN atau menguruskan RBAC.",
    };
  }

  const cleanNewPin = newPin.trim().replace(/\s+/g, "");
  const cleanOldPin = oldPin.trim().replace(/\s+/g, "");

  if (!/^\d{6,7}$/.test(cleanNewPin)) {
    return { success: false, error: "No. Kakitangan / PIN mestilah 6 hingga 7 digit nombor." };
  }

  const registry = getStoredPinRegistry();

  // If changing PIN/StaffNo, ensure new value is not already in use by another user
  if (cleanNewPin !== cleanOldPin && registry[cleanNewPin]) {
    return {
      success: false,
      error: `No. Kakitangan / PIN ${cleanNewPin} telah digunakan oleh pengguna: ${registry[cleanNewPin].label}`,
    };
  }

  const existingConfig = registry[cleanOldPin] || {
    id: `custom_${Date.now()}`,
    pin: cleanNewPin,
    role: updates.role || "staff",
    label: updates.label || "Pengguna",
    estate_id: updates.estate_id || "FPM_TUNGGAL",
    password: updates.password || cleanNewPin,
    username: updates.username || cleanNewPin,
    email: updates.email || `${cleanNewPin}@felda.gov.my`,
    quickAccess: updates.quickAccess ?? false,
    allowedModules: updates.allowedModules || ["dashboard", "hasil", "pekerja"],
  };

  const updatedConfig: RoleUserConfig = {
    ...existingConfig,
    pin: cleanNewPin,
    role: updates.role ?? existingConfig.role,
    label: updates.label ?? existingConfig.label,
    estate_id: updates.estate_id ?? existingConfig.estate_id ?? "FPM_TUNGGAL",
    password: updates.password !== undefined ? updates.password : existingConfig.password,
    username: updates.username !== undefined ? updates.username : existingConfig.username,
    email: updates.email !== undefined ? updates.email : existingConfig.email,
    quickAccess: updates.quickAccess ?? existingConfig.quickAccess,
    allowedModules: updates.allowedModules ?? existingConfig.allowedModules,
    isCustom: true,
  };

  // If old pin differs, remove old key
  if (cleanOldPin !== cleanNewPin) {
    delete registry[cleanOldPin];
  }

  registry[cleanNewPin] = updatedConfig;

  // If the logged in user changed their own PIN or Staff No, update local session keys
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("ipds_last_pin") === cleanOldPin) {
        localStorage.setItem("ipds_last_pin", cleanNewPin);
      }
      if (sessionStorage.getItem("ipds_user_pin") === cleanOldPin) {
        sessionStorage.setItem("ipds_user_pin", cleanNewPin);
      }
    } catch (_) {}
  }

  savePinRegistry(registry);
  return { success: true };
}

/**
 * Async version of updateUserCredential that guarantees server-side synchronization
 */
export async function updateUserCredentialAsync(
  oldPin: string,
  newPin: string,
  updates: {
    role?: AuthRole;
    label?: string;
    estate_id?: string;
    password?: string;
    username?: string;
    email?: string;
    quickAccess?: boolean;
    allowedModules?: ModuleKey[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan menukar PIN atau menguruskan RBAC.",
    };
  }

  const cleanNewPin = newPin.trim().replace(/\s+/g, "");
  const cleanOldPin = oldPin.trim().replace(/\s+/g, "");

  if (!/^\d{6,7}$/.test(cleanNewPin)) {
    return { success: false, error: "No. Kakitangan / PIN mestilah 6 hingga 7 digit nombor." };
  }

  const registry = getStoredPinRegistry();

  if (cleanNewPin !== cleanOldPin && registry[cleanNewPin]) {
    return {
      success: false,
      error: `No. Kakitangan / PIN ${cleanNewPin} telah digunakan oleh pengguna: ${registry[cleanNewPin].label}`,
    };
  }

  const existingConfig = registry[cleanOldPin] || {
    id: `custom_${Date.now()}`,
    pin: cleanNewPin,
    role: updates.role || "staff",
    label: updates.label || "Pengguna",
    estate_id: updates.estate_id || "FPM_TUNGGAL",
    password: updates.password || cleanNewPin,
    username: updates.username || cleanNewPin,
    email: updates.email || `${cleanNewPin}@felda.gov.my`,
    quickAccess: updates.quickAccess ?? false,
    allowedModules: updates.allowedModules || ["dashboard", "hasil", "pekerja"],
  };

  const updatedConfig: RoleUserConfig = {
    ...existingConfig,
    pin: cleanNewPin,
    role: updates.role ?? existingConfig.role,
    label: updates.label ?? existingConfig.label,
    estate_id: updates.estate_id ?? existingConfig.estate_id ?? "FPM_TUNGGAL",
    password: updates.password !== undefined ? updates.password : existingConfig.password,
    username: updates.username !== undefined ? updates.username : existingConfig.username,
    email: updates.email !== undefined ? updates.email : existingConfig.email,
    quickAccess: updates.quickAccess ?? existingConfig.quickAccess,
    allowedModules: updates.allowedModules ?? existingConfig.allowedModules,
    isCustom: true,
  };

  if (cleanOldPin !== cleanNewPin) {
    delete registry[cleanOldPin];
  }

  registry[cleanNewPin] = updatedConfig;

  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("ipds_last_pin") === cleanOldPin) {
        localStorage.setItem("ipds_last_pin", cleanNewPin);
      }
      if (sessionStorage.getItem("ipds_user_pin") === cleanOldPin) {
        sessionStorage.setItem("ipds_user_pin", cleanNewPin);
      }
    } catch (_) {}
  }

  const saveRes = await savePinRegistryAsync(registry);
  return saveRes;
}

/**
 * Add a new custom user with optional password and username
 */
export function addNewUserCredential(
  pin: string,
  label: string,
  role: AuthRole,
  allowedModules?: ModuleKey[],
  estate_id: string = "FPM_TUNGGAL",
  password?: string,
  username?: string,
  email?: string
): { success: boolean; error?: string } {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan menambah akaun pengguna.",
    };
  }

  const cleanPin = pin.trim().replace(/\s+/g, "");
  if (!/^\d{6,7}$/.test(cleanPin)) {
    return { success: false, error: "No. Kakitangan / PIN mestilah 6 hingga 7 digit nombor." };
  }

  const registry = getStoredPinRegistry();
  if (registry[cleanPin]) {
    return {
      success: false,
      error: `No. Kakitangan / PIN ${cleanPin} sudah didaftarkan kepada: ${registry[cleanPin].label}`,
    };
  }

  const newUser: RoleUserConfig = {
    id: `custom_${Date.now()}`,
    pin: cleanPin,
    role,
    label: label.trim() || `Pengguna (${role.toUpperCase()})`,
    estate_id: estate_id || "FPM_TUNGGAL",
    password: password?.trim() || cleanPin,
    username: username?.trim() || cleanPin,
    email: email?.trim() || `${cleanPin}@felda.gov.my`,
    quickAccess: false,
    allowedModules: allowedModules || Object.values(DEFAULT_ROLE_METADATA).find(k => k.role === role)?.allowedModules || ["dashboard", "hasil"],
    isCustom: true,
  };

  registry[cleanPin] = newUser;
  savePinRegistry(registry);
  return { success: true };
}

/**
 * Async version of addNewUserCredential with server synchronization
 */
export async function addNewUserCredentialAsync(
  pin: string,
  label: string,
  role: AuthRole,
  allowedModules?: ModuleKey[],
  estate_id: string = "FPM_TUNGGAL",
  password?: string,
  username?: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan menambah akaun pengguna.",
    };
  }

  const cleanPin = pin.trim().replace(/\s+/g, "");
  if (!/^\d{6,7}$/.test(cleanPin)) {
    return { success: false, error: "No. Kakitangan / PIN mestilah 6 hingga 7 digit nombor." };
  }

  const registry = getStoredPinRegistry();
  if (registry[cleanPin]) {
    return {
      success: false,
      error: `No. Kakitangan / PIN ${cleanPin} sudah didaftarkan kepada: ${registry[cleanPin].label}`,
    };
  }

  const newUser: RoleUserConfig = {
    id: `custom_${Date.now()}`,
    pin: cleanPin,
    role,
    label: label.trim() || `Pengguna (${role.toUpperCase()})`,
    estate_id: estate_id || "FPM_TUNGGAL",
    password: password?.trim() || cleanPin,
    username: username?.trim() || cleanPin,
    email: email?.trim() || `${cleanPin}@felda.gov.my`,
    quickAccess: false,
    allowedModules: allowedModules || Object.values(DEFAULT_ROLE_METADATA).find(k => k.role === role)?.allowedModules || ["dashboard", "hasil"],
    isCustom: true,
  };

  registry[cleanPin] = newUser;
  const saveRes = await savePinRegistryAsync(registry);
  return saveRes;
}

/**
 * Delete a user credential
 */
export function deleteUserCredential(pin: string): { success: boolean; error?: string } {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan memadam akaun pengguna.",
    };
  }

  const registry = getStoredPinRegistry();
  
  let keyToDelete = pin;
  if (!registry[keyToDelete]) {
    const foundKey = Object.keys(registry).find(
      (k) => registry[k].pin === pin || registry[k].id === pin
    );
    if (foundKey) {
      keyToDelete = foundKey;
    }
  }

  if (!registry[keyToDelete]) {
    return { success: false, error: "Pengguna tidak dijumpai dalam senarai." };
  }

  // Prevent deleting the primary FC admin PIN if it's the last remaining FC
  if (registry[keyToDelete].role === "fc" && Object.values(registry).filter((u) => u.role === "fc").length <= 1) {
    return { success: false, error: "Akaun Field Controller (FC) utama tidak boleh dipadam untuk mengelakkan kehilangan akses pentadbir." };
  }

  delete registry[keyToDelete];
  savePinRegistry(registry);
  return { success: true };
}

/**
 * Async version of deleteUserCredential with server synchronization
 */
export async function deleteUserCredentialAsync(pin: string): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin()) {
    return {
      success: false,
      error: "Akses Ditolak: Hanya Super Admin (Field Controller FC FPM Tunggal) yang dibenarkan memadam akaun pengguna.",
    };
  }

  const registry = getStoredPinRegistry();
  
  let keyToDelete = pin;
  if (!registry[keyToDelete]) {
    const foundKey = Object.keys(registry).find(
      (k) => registry[k].pin === pin || registry[k].id === pin
    );
    if (foundKey) {
      keyToDelete = foundKey;
    }
  }

  if (!registry[keyToDelete]) {
    return { success: false, error: "Pengguna tidak dijumpai dalam senarai." };
  }

  if (registry[keyToDelete].role === "fc" && Object.values(registry).filter((u) => u.role === "fc").length <= 1) {
    return { success: false, error: "Akaun Field Controller (FC) utama tidak boleh dipadam untuk mengelakkan kehilangan akses pentadbir." };
  }

  delete registry[keyToDelete];
  const saveRes = await savePinRegistryAsync(registry);
  return saveRes;
}

/**
 * Reset all PINs and roles to factory default
 */
export function resetPinRegistryToDefaults(): boolean {
  if (!isSuperAdmin()) {
    return false;
  }
  return savePinRegistry({ ...DEFAULT_PIN_REGISTRY });
}

/**
 * Enterprise: Reset all PINs and roles to authoritative server defaults
 */
export async function resetPinRegistryToDefaultsAsync(): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin()) {
    return { success: false, error: "Akses Ditolak: Hanya Pentadbir Utama (FC FPM Tunggal) yang dibenarkan menetapkan semula RBAC." };
  }
  return await savePinRegistryAsync({ ...DEFAULT_PIN_REGISTRY });
}

/**
 * Fast lookup for entered PIN, password, username, email, or staff ID
 */
export function getPinInfo(identifier: string): RoleUserConfig | null {
  if (!identifier) return null;
  const registry = getStoredPinRegistry();
  const clean = identifier.trim().replace(/\s+/g, "");
  if (registry[clean]) return registry[clean];

  const cleanLower = clean.toLowerCase();
  for (const user of Object.values(registry)) {
    if (
      user.pin === clean ||
      (user.password && user.password === clean) ||
      (user.username && user.username.toLowerCase() === cleanLower) ||
      (user.email && user.email.toLowerCase() === cleanLower) ||
      (user.id && user.id.toLowerCase() === cleanLower)
    ) {
      return user;
    }
  }
  return null;
}

export const REPORT_TAB_TO_MODULE_KEY: Record<string, ModuleKey> = {
  hasil: "hasil",
  kualiti_bts: "kualiti",
  baja: "fertilizer",
  merumput: "merumput",
  pruning: "pruning",
  pekerja: "pekerja",
  harga: "harga",
  efb: "efb",
  kpi_staff: "kpi_staff",
  hujan: "hujan",
};

/**
 * Retrieve allowed modules for current user or given role/PIN
 */
export function getAllowedModulesForUser(roleOrPin?: string | null): ModuleKey[] {
  if (typeof window === "undefined") {
    return ["dashboard", "hasil", "efb"];
  }

  const sessionRole = (sessionStorage.getItem("ipds_auth_role") || roleOrPin) as AuthRole | null;

  // Super Admin universal access (Rule 1: FC Tunggal, Admin, dan Super Admin adalah orang yang sama)
  if (sessionRole === "fc" || sessionRole === "rc" || sessionRole === "oc") {
    return [
      "dashboard", "hasil", "kualiti", "fertilizer", "merumput", "pruning",
      "pekerja", "efb", "harga", "kpi_staff", "hujan", "sejarah", "ai_executive", "export", "settings"
    ];
  }

  const storedPin = (localStorage.getItem("ipds_last_pin") || (roleOrPin && roleOrPin.length >= 6 ? roleOrPin : ""))
    ?.trim()
    .replace(/\s+/g, "");

  const registry = getStoredPinRegistry();

  if (storedPin && registry[storedPin] && Array.isArray(registry[storedPin].allowedModules)) {
    return registry[storedPin].allowedModules;
  }

  // Fallback to role match in registry
  if (sessionRole) {
    const userMatch = Object.values(registry).find((u) => u.role === sessionRole);
    if (userMatch && Array.isArray(userMatch.allowedModules)) {
      return userMatch.allowedModules;
    }
  }

  // Safe defaults
  if (sessionRole === "staff") return ["hasil", "efb"];
  if (sessionRole === "kerani_kewangan") return ["dashboard", "hasil", "harga", "export"];
  if (sessionRole === "kerani_stok") return ["dashboard", "fertilizer", "efb", "export"];
  if (sessionRole === "kerani_resit") return ["dashboard", "hasil", "efb", "sejarah", "export"];
  if (sessionRole === "mandur") return ["hasil", "pekerja"];
  if (sessionRole === "eqi") return ["dashboard", "kualiti", "sejarah"];
  if (sessionRole === "fs") return ["dashboard", "hasil", "fertilizer", "merumput", "pruning", "pekerja", "hujan", "sejarah"];
  if (sessionRole === "afc") return ["dashboard", "hasil", "kualiti", "fertilizer", "merumput", "pruning", "pekerja", "efb", "harga", "kpi_staff", "hujan", "sejarah", "export"];
  if (sessionRole === "pf") return ["dashboard", "hasil", "kualiti", "fertilizer", "merumput", "pruning", "pekerja", "efb", "harga", "kpi_staff", "hujan", "sejarah", "ai_executive", "export"];

  return ["dashboard", "hasil"];
}

/**
 * Recalculate dynamic report tabs according to allowed modules
 */
export function getReportTabsForUser(
  allowedModules: ModuleKey[],
  role?: AuthRole | null
): { id: string; label: string }[] {
  // Super Admin universal access
  if (role === "fc" || role === "rc" || role === "oc") {
    return [
      { id: "hasil", label: "Hasil" },
      { id: "kualiti_bts", label: "Kualiti BTS" },
      { id: "baja", label: "Membaja" },
      { id: "merumput", label: "Merumput" },
      { id: "pruning", label: "Pruning" },
      { id: "pekerja", label: "iPDS Muster" },
      { id: "harga", label: "Harga Bts" },
      { id: "efb", label: "Efb" },
      { id: "kpi_staff", label: "KPI Staff" },
    ];
  }

  const allPossibleTabs = [
    { id: "hasil", label: "Hasil" },
    { id: "kualiti_bts", label: "Kualiti BTS" },
    { id: "baja", label: "Membaja" },
    { id: "merumput", label: "Merumput" },
    { id: "pruning", label: "Pruning" },
    { id: "pekerja", label: "iPDS Muster" },
    { id: "harga", label: "Harga Bts" },
    { id: "efb", label: "Efb" },
    { id: "kpi_staff", label: "KPI Staff" },
  ];

  return allPossibleTabs.filter((tab) => {
    const modKey = REPORT_TAB_TO_MODULE_KEY[tab.id];
    if (!modKey) return true;
    return allowedModules.includes(modKey);
  });
}

/**
 * Check if current user or role has access to a specific module
 */
export function checkModulePermission(role: AuthRole | null, moduleKey: ModuleKey): boolean {
  if (!role) return false;
  if (moduleKey === "settings") {
    return isSuperAdmin(role);
  }
  if (role === "fc" || role === "rc" || role === "oc") return true; // Super Admin universal operational access

  const allowed = getAllowedModulesForUser(role);
  return allowed.includes(moduleKey);
}

export const canAccessModule = checkModulePermission;

/**
 * Get current user's registered home estate ID
 */
export function getCurrentUserEstate(authRole?: string | null): string {
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("ipds_user_estate") || localStorage.getItem("ipds_user_estate");
      if (stored) return normalizeEstateId(stored);

      const lastPin = localStorage.getItem("ipds_last_pin")?.trim().replace(/\s+/g, "");
      if (lastPin) {
        const reg = getStoredPinRegistry();
        if (reg[lastPin]?.estate_id) {
          return normalizeEstateId(reg[lastPin].estate_id);
        }
      }
    } catch (_) {}
  }
  return normalizeEstateId(getActiveEstateId()) || "FPM_TUNGGAL";
}

