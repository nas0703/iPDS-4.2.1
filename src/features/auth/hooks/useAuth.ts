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

export function useAuth({ onLoginSuccess, onLogout }: UseAuthProps) {
  const onLoginSuccessRef = useRef(onLoginSuccess);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLoginSuccessRef.current = onLoginSuccess;
    onLogoutRef.current = onLogout;
  });

  // Start strictly unauthenticated with null; never trust unverified localStorage
  const [authRole, setAuthRole] = useState<AuthRole>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState(false);
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

  // Restore authenticated session ONCE on initial mount via authoritative /api/auth/me check
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const storedToken = sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token");
        const storedPin = localStorage.getItem("ipds_last_pin");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
        if (storedPin) headers["x-auth-pin"] = storedPin;

        const res = await fetch("/api/auth/me", {
          credentials: "include",
          headers,
          signal: controller.signal
        }).catch(() => null);
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user && isMounted) {
            const role = (data.user.role === 'mandur' ? 'staff' : data.user.role) as "staff" | "fc" | "afc" | "fs" | "pf" | "eqi" | "oc" | "rc";
            
            // For multi-estate roles (rc, oc, pf), preserve existing valid estate selection
            const currentEstate = getActiveEstateId();
            if (canSwitchEstates(role)) {
              if (!currentEstate || currentEstate === 'undefined') {
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
            } catch (e) {}

            setAuthRole(role as AuthRole);
            onLoginSuccessRef.current(role as RbacAuthRole);
            return;
          }
        }

        // Seamless re-auth fallback if stored PIN exists
        if (storedPin && isMounted) {
          const pinRes = await fetch("/api/auth/verify-pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ pin: storedPin, requestedEstate: getActiveEstateId() })
          }).catch(() => null);

          if (pinRes && pinRes.ok) {
            const pinData = await pinRes.json().catch(() => null);
            if (pinData?.success && pinData?.user?.role) {
              if (pinData.token) {
                sessionStorage.setItem("ipds_token", pinData.token);
                localStorage.setItem("ipds_token", pinData.token);
              }
              const role = (pinData.user.role === 'mandur' ? 'staff' : pinData.user.role) as "staff" | "fc" | "afc" | "fs" | "pf" | "eqi" | "oc" | "rc";
              try {
                if (pinData.user.estate_id) {
                  localStorage.setItem("ipds_user_estate", pinData.user.estate_id);
                  sessionStorage.setItem("ipds_user_estate", pinData.user.estate_id);
                }
                if (pinData.user.is_super_admin !== undefined) {
                  localStorage.setItem("ipds_is_super_admin", String(pinData.user.is_super_admin));
                  sessionStorage.setItem("ipds_is_super_admin", String(pinData.user.is_super_admin));
                }
              } catch (e) {}
              setAuthRole(role as AuthRole);
              onLoginSuccessRef.current(role as RbacAuthRole);
              return;
            }
          }
        }
      } catch (err) {
        // Session check network failure
      }

      // If server session is not authenticated or invalid, ensure state is clean
      if (isMounted) {
        setAuthRole(null);
        try {
          sessionStorage.removeItem("ipds_auth_role");
          localStorage.removeItem("ipds_auth_role");
          sessionStorage.removeItem("ipds_token");
          sessionStorage.removeItem("ipds_is_super_admin");
          localStorage.removeItem("ipds_is_super_admin");
        } catch (e) {}
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []); // Run ONLY once on mount

  // Immediately refresh active session if credentials or roles are updated in RBAC Manager
  useEffect(() => {
    const handleRbacUpdate = async () => {
      try {
        const storedToken = sessionStorage.getItem("ipds_token") || localStorage.getItem("ipds_token");
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          headers
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user) {
            const role = (data.user.role === 'mandur' ? 'staff' : data.user.role) as AuthRole;
            setAuthRole(role);
            sessionStorage.setItem("ipds_auth_role", role as string);
            if (data.user.estate_id) {
              setRuntimeEstateId(data.user.estate_id);
            }
          }
        }
      } catch (err) {
        console.warn("Error processing RBAC sync update in useAuth:", err);
      }
    };

    window.addEventListener("rbac_registry_updated", handleRbacUpdate);
    return () => {
      window.removeEventListener("rbac_registry_updated", handleRbacUpdate);
    };
  }, []);

  // P1 soft-merge: adopt the server-validated canonical device_id (returned only
  // in an authenticated DEVICE_MERGED response) so the client stops presenting
  // the retired duplicate device_id.
  const adoptCanonicalDeviceId = useCallback((data: { code?: string; canonicalDeviceId?: string } | null | undefined): boolean => {
    if (data?.code === 'DEVICE_MERGED' && data?.canonicalDeviceId) {
      setClientDeviceId(String(data.canonicalDeviceId));
      return true;
    }
    return false;
  }, []);

  // API-First: Verify PIN strictly with server endpoint (/api/auth/verify-pin)
  const verifyPinOnServer = useCallback(async (enteredPin: string, allowMergeRetry: boolean = true) => {
    setIsVerifying(true);
    setLoginError(false);
    const cleanPin = enteredPin.trim().replace(/\s+/g, '');
    const clientInfo = getClientDeviceInfo();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pin: cleanPin,
          requestedEstate: getActiveEstateId(),
          deviceId: clientInfo.deviceId,
          deviceName: clientInfo.deviceName,
          deviceCredential: getDeviceCredential()
        }),
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res) {
        const data = await res.json().catch(() => null);

        if (adoptCanonicalDeviceId(data) && allowMergeRetry) {
          setIsVerifying(false);
          return verifyPinOnServer(enteredPin, false);
        }

        if (res.status === 403 || data?.code === 'DEVICE_NOT_APPROVED') {
          setDeviceApprovalState({
            isBlocked: true,
            device: data?.device || { deviceId: clientInfo.deviceId, deviceName: clientInfo.deviceName, status: 'PENDING' },
            approvalUrl: data?.approvalUrl,
            message: data?.error || 'Peranti belum diluluskan oleh Pentadbir Ladang.'
          });
          setIsVerifying(false);
          setPin("");
          return;
        }

        if (res.ok && data?.success && data?.user?.role) {
          setDeviceApprovalState(null);
          const userRole = (data.user.role === 'mandur' ? 'staff' : data.user.role) as "staff" | "fc" | "afc" | "fs" | "pf" | "eqi" | "oc" | "rc";
          const isMultiEstate = canSwitchEstates(userRole);
          const currentActive = getActiveEstateId();

          if (isMultiEstate) {
            if (!currentActive || currentActive === 'undefined') {
              setRuntimeEstateId(data.user.estate_id || "FPM_TUNGGAL");
            }
          } else if (data.user.estate_id) {
            setRuntimeEstateId(data.user.estate_id);
          }

          if (data.token) {
            sessionStorage.setItem("ipds_token", data.token);
            localStorage.setItem("ipds_token", data.token);
          }
          try {
            localStorage.setItem("ipds_last_pin", cleanPin);
            sessionStorage.setItem("ipds_auth_role", userRole);
            if (data.user.estate_id) {
              localStorage.setItem("ipds_user_estate", data.user.estate_id);
              sessionStorage.setItem("ipds_user_estate", data.user.estate_id);
            }
            if (data.user.is_super_admin !== undefined) {
              localStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
              sessionStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
            }
          } catch (e) {}

          setAuthRole(userRole as AuthRole);
          setPin("");
          setLoginError(false);
          onLoginSuccessRef.current(userRole as RbacAuthRole);
          return;
        }
      }

      // Truly invalid PIN or unauthenticated
      setLoginError(true);
      setPin("");
      setAuthRole(null);
    } catch (err) {
      console.error("Authentication check error:", err);
      setLoginError(true);
      setPin("");
      setAuthRole(null);
    } finally {
      setIsVerifying(false);
    }
  }, [adoptCanonicalDeviceId]);

  // API-First: Verify Staff credentials strictly with server endpoint (/api/auth/verify-staff)
  const verifyStaffCredentials = useCallback(async (estateCode: string, staffNo: string, allowMergeRetry: boolean = true) => {
    setIsVerifying(true);
    setLoginError(false);

    const cleanStaff = (staffNo || "").trim().toUpperCase();
    const targetEstate = normalizeEstateId(estateCode);
    const clientInfo = getClientDeviceInfo();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/auth/verify-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          estate_code: targetEstate,
          staff_no: cleanStaff,
          deviceId: clientInfo.deviceId,
          deviceName: clientInfo.deviceName,
          deviceCredential: getDeviceCredential()
        }),
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res) {
        const data = await res.json().catch(() => null);

        if (adoptCanonicalDeviceId(data) && allowMergeRetry) {
          setIsVerifying(false);
          return verifyStaffCredentials(estateCode, staffNo, false);
        }

        if (res.status === 403 || data?.code === 'DEVICE_NOT_APPROVED') {
          setDeviceApprovalState({
            isBlocked: true,
            device: data?.device || { deviceId: clientInfo.deviceId, deviceName: clientInfo.deviceName, status: 'PENDING' },
            approvalUrl: data?.approvalUrl,
            message: data?.error || 'Peranti belum diluluskan oleh Pentadbir Ladang.'
          });
          setIsVerifying(false);
          return false;
        }

        if (res.ok && data?.success && data?.user?.role) {
          setDeviceApprovalState(null);
          const userEstate = normalizeEstateId(data.user.estate_id);
          const roleRaw = (data.user.role === 'mandur' ? 'staff' : data.user.role) as "staff" | "fc" | "afc" | "fs" | "pf" | "eqi" | "oc" | "rc";
          const isMulti = ["rc", "oc"].includes(String(roleRaw).toLowerCase().trim());
          if (!isMulti && userEstate !== targetEstate) {
            console.warn(`[AUTH DENIED] Server strict combination mismatch: Staff ${cleanStaff} is assigned to ${userEstate}, but selected ${targetEstate}`);
            setLoginError(true);
            setAuthRole(null);
            setIsVerifying(false);
            return false;
          }

          const activeEstate = isMulti ? targetEstate : userEstate;
          setRuntimeEstateId(activeEstate);

          if (data.token) {
            sessionStorage.setItem("ipds_token", data.token);
            localStorage.setItem("ipds_token", data.token);
          }
          try {
            localStorage.setItem("ipds_last_pin", cleanStaff);
            sessionStorage.setItem("ipds_auth_role", roleRaw);
            localStorage.setItem("ipds_user_estate", activeEstate);
            sessionStorage.setItem("ipds_user_estate", activeEstate);
          } catch (e) {}

          setAuthRole(roleRaw as AuthRole);
          setPin("");
          setLoginError(false);
          onLoginSuccessRef.current(roleRaw as RbacAuthRole);
          return true;
        }
      }

      // Strictly reject unverified credentials
      setLoginError(true);
      setAuthRole(null);
      return false;
    } catch (err) {
      console.error("Staff credentials authentication error:", err);
      setLoginError(true);
      setAuthRole(null);
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [adoptCanonicalDeviceId]);

  // API-First: Verify Password strictly with server endpoint (/api/auth/verify-password)
  const verifyPasswordOnServer = useCallback(async (identity: string, pass: string) => {
    setIsVerifying(true);
    setLoginError(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identity, password: pass }),
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.user?.role) {
          if (data.user.estate_id) {
            setRuntimeEstateId(data.user.estate_id);
          }
          if (data.token) {
            sessionStorage.setItem("ipds_token", data.token);
            localStorage.setItem("ipds_token", data.token);
          }
          const role = (data.user.role === 'mandur' ? 'staff' : data.user.role) as "staff" | "fc" | "afc" | "fs" | "pf" | "eqi" | "oc" | "rc";
          setAuthRole(role as AuthRole);
          setPin("");
          setLoginError(false);
          try {
            sessionStorage.setItem("ipds_auth_role", role);
            if (data.user.estate_id) {
              localStorage.setItem("ipds_user_estate", data.user.estate_id);
              sessionStorage.setItem("ipds_user_estate", data.user.estate_id);
            }
            if (data.user.is_super_admin !== undefined) {
              localStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
              sessionStorage.setItem("ipds_is_super_admin", String(data.user.is_super_admin));
            }
          } catch (e) {}
          onLoginSuccessRef.current(role as RbacAuthRole);
          return true;
        }
      }

      setLoginError(true);
      setAuthRole(null);
      return false;
    } catch (err) {
      console.error("Password authentication error:", err);
      setLoginError(true);
      setAuthRole(null);
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const handlePinPress = useCallback((digit: string) => {
    if (pin.length < 7) {
      const newPin = pin + digit;
      setPin(newPin);
      setLoginError(false);

      if (newPin.length >= 6) {
        verifyPinOnServer(newPin);
      }
    }
  }, [pin, verifyPinOnServer]);

  const handleDeletePress = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setLoginError(false);
  }, []);

  const handleQuickLogin = useCallback((targetPin: string) => {
    verifyPinOnServer(targetPin);
  }, [verifyPinOnServer]);

  const handleLogout = useCallback(async () => {
    try {
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    setAuthRole(null);
    setPin("");
    try {
      sessionStorage.removeItem("ipds_auth_role");
      localStorage.removeItem("ipds_auth_role");
      sessionStorage.removeItem("ipds_token");
      localStorage.removeItem("ipds_token");
      localStorage.removeItem("ipds_last_pin");
      sessionStorage.removeItem("merumput_app_session_modal_v34_premium");
      sessionStorage.removeItem("backlog_app_session_modal_v2_premium");
    } catch (e) {}
    onLogoutRef.current();
  }, []);

  return {
    authRole,
    setAuthRole,
    pin,
    loginError,
    isVerifying,
    deviceApprovalState,
    setDeviceApprovalState,
    handlePinPress,
    handleDeletePress,
    handleQuickLogin,
    verifyStaffCredentials,
    verifyPasswordOnServer,
    handleLogout
  };
}
