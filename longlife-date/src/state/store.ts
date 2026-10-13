import type { Encounter } from "../domain/types";

type Listener = (state: State) => void;

export interface State {
  encounters: Encounter[];
  loading: boolean;
  error: string | null;
}

const initialState: State = {
  encounters: [],
  loading: false,
  error: null,
};

export class EncounterStore {
  private state: State = initialState;
  private listeners: Set<Listener> = new Set();

  getState(): State {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    // devolve função de cancelamento — padrão Redux
    return () => this.listeners.delete(fn);
  }

  set(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  setEncounters(encounters: Encounter[]): void {
    this.set({ encounters, error: null });
  }

  setLoading(loading: boolean): void {
    this.set({ loading });
  }

  setError(error: string | null): void {
    this.set({ error });
  }
}