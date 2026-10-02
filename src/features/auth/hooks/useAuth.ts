import { useState, useCallback, useEffect, useRef } from "react";
import { getActiveEstateId, setRuntimeEstateId } from "../../../utils/estateContext";
import { canSwitchEstates, normalizeEstateId } from "../../../config/estateRegistry";
import { AuthRole as RbacAuthRole } from "../services/rbacService";
import { getClientDeviceInfo, getDeviceCredential, setClientDeviceId } from "../../../utils/deviceHelper";

export type AuthRole = RbacAuthRole | null;

interface UseAuthProps {
  onLoginSuccess: (role: RbacAuthRole) => void;
  onLogout: () => void;
}

function clearStoredAuthState() {
  try {
    for (const storage of [sessionStorage, localStorage]) {
      storage.removeItem("ipds_auth_role");
      storage.removeItem("ipds_token");
      storage.removeItem("ipds_is_super_admin");
      storage.removeItem("ipds_user_estate");
    }
    localStorage.removeItem("ipds_last_pin");
  } catch {}
}

export function useAuth({ onLoginSuccess, onLogout }: UseAuthProps) {
  const onLoginSuccessRef = useRef(onLoginSuccess);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLoginSuccessRef.current = onLoginSuccess;
    onLogoutRef.current = onLogout;
  });

  const [authRole, setAuthRole] = useState<AuthRole>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [deviceApprovalState, setDeviceApprovalState] = useState<{
    isBlocked: boolean;
    device?: {
      deviceId: string;
      deviceName?: string;
      status: string;
      operatorName?: string;
      createdAt?: string;
    };
    approvalUrl?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try { localStorage.removeItem("ipds_last_pin"); } catch {}
      const storedToken = sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token");
      const headers: Record<string, string> = {};
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      let res: Response | null = null;

      try {
        res = await fetch("/api/auth/me", {
          credentials: "include",
          headers,
          signal: controller.signal
        }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user && isMounted) {
            const role = (data.user.role === "mandur" ? "staff" : data.user.role) as RbacAuthRole;
            const currentEstate = getActiveEstateId();
            if (canSwitchEstates(role)) {
              if (!currentEstate || currentEstate === "undefined") {
                setRuntimeEstateId(data.user.estate_id || "FPM_TUNGGAL");
              }
            } else if (data.user.estate_id) {
              setRuntimeEstateId(data.user.estate_id);
            }
            try {
              if (data.user.estate_id) {
                localStorage.setItem("ipds_user_estate", data.user.estate_id);
                sessionStorage.setItem("ipds_user_estate", data.user.estate_id);
              }
              if (data.user.is_super_admin !== undefined) {
                localStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
                sessionStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
              }
            } catch {}
            setAuthRole(role);
            onLoginSuccessRef.current(role);
            return;
          }
        }
      } catch {
        // Keep stored credentials available when the session endpoint is unreachable.
      } finally {
        clearTimeout(timeoutId);
      }

      if (isMounted && res && (res.status === 401 || res.status === 403)) {
        clearStoredAuthState();
      }
    }

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleRbacUpdate = async () => {
      try {
        const storedToken = sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token");
        const headers: Record<string, string> = {};
        if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
        const res = await fetch("/api/auth/me", { credentials: "include", headers }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user) {
            const role = (data.user.role === "mandur" ? "staff" : data.user.role) as AuthRole;
            setAuthRole(role);
            sessionStorage.setItem("ipds_auth_role", role as string);
            if (data.user.estate_id) setRuntimeEstateId(data.user.estate_id);
          }
        }
      } catch (err) {
        console.warn("Error processing RBAC sync update in useAuth:", err);
      }
    };

    window.addEventListener("rbac_registry_updated", handleRbacUpdate);
    return () => window.removeEventListener("rbac_registry_updated", handleRbacUpdate);
  }, []);

  const adoptCanonicalDeviceId = useCallback((data: { code?: string; canonicalDeviceId?: string } | null | undefined): boolean => {
    if (data?.code === "DEVICE_MERGED" && data?.canonicalDeviceId) {
      setClientDeviceId(String(data.canonicalDeviceId));
      return true;
    }
    return false;
  }, []);

  const verifyStaffCredentials = useCallback(async (estateCode: string, staffNo: string, allowMergeRetry: boolean = true): Promise<boolean> => {
    setIsVerifying(true);
    const normalizedStaffNo = staffNo.trim().toUpperCase();
    const targetEstate = normalizeEstateId(estateCode);
    const clientInfo = getClientDeviceInfo();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const payload = JSON.stringify({
        estate_code: targetEstate,
        staff_no: normalizedStaffNo,
        deviceId: clientInfo.deviceId,
        deviceName: clientInfo.deviceName,
        deviceCredential: getDeviceCredential()
      });

      let res: Response;
      try {
        res = await fetch("/api/auth/verify-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: payload,
          signal: controller.signal
        });
      } catch (firstErr) {
        // Fallback for sandboxed or cross-site iframes where credentials: 'include' is restricted by browser
        try {
          res = await fetch("/api/auth/verify-staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: payload,
            signal: controller.signal
          });
        } catch {
          throw firstErr;
        }
      }
      const data = await res.json().catch(() => null);

      if (adoptCanonicalDeviceId(data) && allowMergeRetry) {
        return await verifyStaffCredentials(estateCode, staffNo, false);
      }

      if (res.status === 403 && data?.code === "DEVICE_NOT_APPROVED") {
        setDeviceApprovalState({
          isBlocked: true,
          device: data?.device || { deviceId: clientInfo.deviceId, deviceName: clientInfo.deviceName, status: "PENDING" },
          approvalUrl: data?.approvalUrl,
          message: data?.error || "Peranti belum diluluskan oleh Pentadbir Ladang."
        });
        clearStoredAuthState();
        return false;
      }

      if (res.ok && data?.success && data?.user?.role) {
        setDeviceApprovalState(null);
        const role = (data.user.role === "mandur" ? "staff" : data.user.role) as RbacAuthRole;
        const userEstate = normalizeEstateId(data.user.estate_id);
        const activeEstate = canSwitchEstates(role) ? targetEstate : userEstate;
        setRuntimeEstateId(activeEstate);
        if (data.token) {
          sessionStorage.setItem("ipds_token", data.token);
          localStorage.setItem("ipds_token", data.token);
        }
        try {
          sessionStorage.setItem("ipds_auth_role", role);
          sessionStorage.setItem("ipds_user_estate", activeEstate);
          localStorage.setItem("ipds_user_estate", activeEstate);
          if (data.user.is_super_admin !== undefined) {
            sessionStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
            localStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
          }
        } catch {}
        setAuthRole(role);
        onLoginSuccessRef.current(role);
        return true;
      }

      setAuthRole(null);
      clearStoredAuthState();
      return false;
    } catch (err) {
      console.error("Kiosk authentication request failed:", err);
      setAuthRole(null);
      clearStoredAuthState();
      return false;
    } finally {
      clearTimeout(timeoutId);
      setIsVerifying(false);
    }
  }, [adoptCanonicalDeviceId]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    setAuthRole(null);
    clearStoredAuthState();
    try {
      sessionStorage.removeItem("merumput_app_session_modal_v34_premium");
      sessionStorage.removeItem("backlog_app_session_modal_v2_premium");
    } catch {}
    onLogoutRef.current();
  }, []);

  return {
    authRole,
    setAuthRole,
    isVerifying,
    deviceApprovalState,
    setDeviceApprovalState,
    verifyStaffCredentials,
    handleLogout
  };
}
