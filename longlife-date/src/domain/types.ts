export interface Encounter {
  id: number;
  date: string;        // "YYYY-MM-DD"
  location: string;
  description: string;
  photoFile: string | null;
  createdAt: string;
  updatedAt: string;
}