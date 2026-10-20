import { invoke } from "@tauri-apps/api/core";

export async function checkHasAccount(): Promise<boolean> {
  return invoke<boolean>("check_has_account");
}

export async function setupAccount(password: string): Promise<string> {
  return invoke<string>("setup_account", { password });
}

export async function resetPasswordWithRecoveryCode(
  recoveryCode: string,
  newPassword: string,
): Promise<void> {
  return invoke<void>("reset_password_with_recovery_code", {
    recoveryCode,
    newPassword,
  });
}

export async function factoryResetUnauthenticated(): Promise<void> {
  return invoke<void>("factory_reset_unauthenticated");
}

export async function login(password: string): Promise<boolean> {
  return invoke<boolean>("login", { password });
}

export async function logout(): Promise<void> {
  return invoke<void>("logout");
}
