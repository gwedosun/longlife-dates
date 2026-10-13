import { invoke } from "@tauri-apps/api/core";
import type {
  Encounter,
  CreateEncounterInput,
  UpdateEncounterInput,
} from "../domain/types";

export async function createEncounter(input: CreateEncounterInput): Promise<number> {
  return invoke<number>("create_encounter_cmd", {
    date: input.date,
    location: input.location,
    description: input.description,
    photoBytes: input.photoBytes ? Array.from(input.photoBytes) : null,
  });
}

export async function getEncounter(id: number): Promise<Encounter> {
  return invoke<Encounter>("get_encounter_cmd", { id });
}

export interface ListFilters {
  query?: string;
  from?: string; // ISO
  to?: string;   // ISO
  desc: boolean;
}

export async function listEncounters(filters: ListFilters): Promise<Encounter[]> {
  return invoke<Encounter[]>("list_encounters_cmd", {
    query: filters.query ?? null,
    from: filters.from ?? null,
    to: filters.to ?? null,
    desc: filters.desc,
  });
}

export async function updateEncounter(input: UpdateEncounterInput): Promise<void> {
  return invoke("update_encounter_cmd", {
    id: input.id,
    date: input.date,
    location: input.location,
    description: input.description,
    newPhotoBytes: input.newPhotoBytes ? Array.from(input.newPhotoBytes) : null,
  });
}

export async function deleteEncounter(id: number): Promise<void> {
  return invoke("delete_encounter_cmd", { id });
}

export async function getPhotoPath(filename: string): Promise<string> {
  return invoke<string>("get_photo_path_cmd", { filename });
}

export async function readPhoto(filename: string): Promise<string> {
  return invoke<string>("read_photo_cmd", { filename });
}

export function mimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function deleteAllData(): Promise<void> {
  return invoke("delete_all_data_cmd");
}

export async function exportBackup(): Promise<string> {
  return invoke<string>("export_backup_cmd");
}

export async function importBackup(json: string): Promise<number> {
  return invoke<number>("import_backup_cmd", { json });
}