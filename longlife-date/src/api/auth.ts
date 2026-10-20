import { invoke } from "@tauri-apps/api/core";

export async function checkHasAccount(): Promise<boolean> {
  return invoke<boolean>("check_has_account");
}

export async function setupAccount(password: string): Promise<void> {
  return invoke<void>("setup_account", { password });
}

export async function login(password: string): Promise<boolean> {
  return invoke<boolean>("login", { password });
}

export async function logout(): Promise<void> {
  return invoke<void>("logout");
}

