import { describe, it, expect } from "vitest";
import { isValidIsoDate, isoToBr, brToIso } from "./date";

// ---------- UT-18: validação ISO ----------
describe("isValidIsoDate", () => {
  it("aceita datas ISO reais", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true); // bissexto
    expect(isValidIsoDate("2024-01-01")).toBe(true);
    expect(isValidIsoDate("1999-12-31")).toBe(true);
  });

  it("rejeita formatos errados", () => {
    expect(isValidIsoDate("14/02/2024")).toBe(false);
    expect(isValidIsoDate("2024-2-9")).toBe(false); // zero à esquerda faltando
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2024/02/14")).toBe(false);
  });

  it("rejeita datas inexistentes", () => {
    expect(isValidIsoDate("2023-02-29")).toBe(false);
    expect(isValidIsoDate("2024-13-01")).toBe(false);
    expect(isValidIsoDate("2024-04-31")).toBe(false);
  });
});

// ---------- UT-19: conversão ISO ↔ BR ----------
describe("isoToBr", () => {
  it("converte ISO válida para BR", () => {
    expect(isoToBr("2024-02-29")).toBe("29/02/2024");
    expect(isoToBr("1999-12-31")).toBe("31/12/1999");
  });

  it("lança em ISO inválida", () => {
    expect(() => isoToBr("2023-02-29")).toThrow();
    expect(() => isoToBr("14/02/2024")).toThrow();
  });
});

describe("brToIso", () => {
  it("converte BR válida para ISO", () => {
    expect(brToIso("29/02/2024")).toBe("2024-02-29");
    expect(brToIso("31/12/1999")).toBe("1999-12-31");
  });

  it("lança em BR inválida ou inexistente", () => {
    expect(() => brToIso("29/02/2023")).toThrow();
    expect(() => brToIso("2024-02-29")).toThrow();
    expect(() => brToIso("")).toThrow();
  });

  it("faz round-trip com isoToBr", () => {
    const original = "2024-06-15";
    expect(brToIso(isoToBr(original))).toBe(original);
  });
});

import { parseBrDate } from "./date";

describe("parseBrDate", () => {
  it("aceita data válida", () => {
    const r = parseBrDate("29/02/2024");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe("2024-02-29");
  });

  it("marca formato errado como 'format'", () => {
    expect(parseBrDate("2024-02-29")).toEqual({ ok: false, error: "format" });
    expect(parseBrDate("")).toEqual({ ok: false, error: "format" });
    expect(parseBrDate("1/2/2024")).toEqual({ ok: false, error: "format" });
  });

  it("marca data inexistente como 'nonexistent'", () => {
    expect(parseBrDate("29/02/2023")).toEqual({ ok: false, error: "nonexistent" });
    expect(parseBrDate("31/04/2024")).toEqual({ ok: false, error: "nonexistent" });
    expect(parseBrDate("31/02/2024")).toEqual({ ok: false, error: "nonexistent" });
  });
});

import { formatDate, daysSince } from "./date";

// ---------- UT-18: Formatação de data PT-BR ----------
describe("formatDate (UT-18)", () => {
  it("formata data ISO para extenso em PT-BR sem off-by-one", () => {
    expect(formatDate("2024-02-14")).toBe("14 de fevereiro de 2024");
    expect(formatDate("2024-01-01")).toBe("1 de janeiro de 2024");
    expect(formatDate("2024-12-31")).toBe("31 de dezembro de 2024");
  });

  it("lança erro com data ISO inválida", () => {
    expect(() => formatDate("invalida")).toThrow();
    expect(() => formatDate("2023-02-29")).toThrow();
  });
});

// ---------- UT-19: Contador 'dias juntos' ----------
describe("daysSince (UT-19)", () => {
  it("calcula a diferença correta de dias", () => {
    expect(daysSince("2024-01-01", "2024-01-11")).toBe(10);
    expect(daysSince("2024-02-01", "2024-03-01")).toBe(29); // 2024 é bissexto
    expect(daysSince("2024-01-01", "2024-01-01")).toBe(0);
  });

  it("lança erro para datas inválidas", () => {
    expect(() => daysSince("invalid", "2024-01-01")).toThrow();
  });
});