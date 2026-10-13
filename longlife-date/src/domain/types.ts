export interface Encounter {
  id: number;
  /** ISO `YYYY-MM-DD` */
  date: string;
  location: string;
  description: string;
  photoFile: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEncounterInput {
  date: string;
  location: string;
  description: string;
  photoBytes: Uint8Array | null;
}

export interface UpdateEncounterInput {
  id: number;
  date: string;
  location: string;
  description: string;
  newPhotoBytes: Uint8Array | null;
}