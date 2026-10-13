import { describe, it, expect, vi } from "vitest";
import { EncounterStore } from "./store";
import type { Encounter } from "../domain/types";

function mkEncounter(id: number): Encounter {
  return {
    id,
    date: "2024-05-20",
    location: "Praia",
    description: "",
    photoFile: null,
    createdAt: "2024-05-20 10:00:00",
    updatedAt: "2024-05-20 10:00:00",
  };
}

describe("EncounterStore", () => {
  it("começa vazio", () => {
    const s = new EncounterStore();
    expect(s.getState().encounters).toEqual([]);
    expect(s.getState().loading).toBe(false);
    expect(s.getState().error).toBeNull();
  });

  it("notifica ouvintes em mudanças", () => {
    const s = new EncounterStore();
    const spy = vi.fn();
    s.subscribe(spy);

    s.setLoading(true);
    s.setEncounters([mkEncounter(1)]);
    s.setError("ops");

    expect(spy).toHaveBeenCalledTimes(3);
    // última chamada recebe o estado consolidado
    const last = spy.mock.calls.at(-1)![0];
    expect(last.error).toBe("ops");
    expect(last.encounters).toHaveLength(1);
  });

  it("unsubscribe para de notificar", () => {
    const s = new EncounterStore();
    const spy = vi.fn();
    const off = s.subscribe(spy);

    s.setLoading(true);
    off();
    s.setLoading(false);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("setEncounters limpa erro anterior", () => {
    const s = new EncounterStore();
    s.setError("algo deu errado");
    s.setEncounters([mkEncounter(1)]);
    expect(s.getState().error).toBeNull();
  });
});