export interface KioskLoginAttemptResult {
  success: boolean;
  requestFailed: boolean;
}

export async function runKioskLoginAttempt(
  verify: (estateCode: string, staffNo: string) => Promise<boolean>,
  estateCode: string,
  staffNo: string,
  setSubmitting: (submitting: boolean) => void
): Promise<KioskLoginAttemptResult> {
  setSubmitting(true);
  try {
    return { success: await verify(estateCode, staffNo), requestFailed: false };
  } catch {
    return { success: false, requestFailed: true };
  } finally {
    setSubmitting(false);
  }
}
