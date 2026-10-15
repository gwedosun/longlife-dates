/**
 * Regras de data do frontend.
 *
 * O backend trabalha exclusivamente com ISO `YYYY-MM-DD`.
 * A UI trabalha com `DD/MM/AAAA` (padrão brasileiro).
 * Estas funções são a única fronteira entre os dois mundos.
 */


// import { isoToBr, parseBrDate } from "./domain/date";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const BR_RE = /^\d{2}\/\d{2}\/\d{4}$/;

/**
 * Valida se uma string está no formato ISO YYYY-MM-DD e representa
 * uma data real (rejeita 2023-02-29, por exemplo).
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;

  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  // Rejeita datas "que rolam" (ex.: 2023-02-29 vira 2023-03-01)
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * ISO `YYYY-MM-DD` → BR `DD/MM/AAAA`.
 * Lança se a entrada não for ISO válida — o programador deve validar antes.
 */
export function isoToBr(iso: string): string {
  if (!isValidIsoDate(iso)) {
    throw new Error(`Data ISO inválida: ${iso}`);
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * BR `DD/MM/AAAA` → ISO `YYYY-MM-DD`.
 * Lança se a entrada não for BR válida ou não representar uma data real.
 */
export function brToIso(br: string): string {
  if (!BR_RE.test(br)) {
    throw new Error(`Data BR inválida: ${br}`);
  }
  const [d, m, y] = br.split("/");
  const iso = `${y}-${m}-${d}`;
  if (!isValidIsoDate(iso)) {
    throw new Error(`Data inexistente: ${br}`);
  }
  return iso;
}

export type BrDateError = "format" | "nonexistent";
export type BrDateResult =
  | { ok: true; iso: string }
  | { ok: false; error: BrDateError };

/**
 * Faz o parsing de uma data brasileira e diz exatamente por que falhou.
 * Use isto quando a mensagem exata importa para o usuário.
 */
export function parseBrDate(br: string): BrDateResult {
  if (!BR_RE.test(br)) return { ok: false, error: "format" };

  const [d, m, y] = br.split("/");
  const iso = `${y}-${m}-${d}`;
  if (!isValidIsoDate(iso)) return { ok: false, error: "nonexistent" };

  return { ok: true, iso };
}

/**
 * Formatação de data ISO para PT-BR por extenso: "14 de fevereiro de 2024" (UT-18).
 * Não sofre com problemas de fuso horário local.
 */
export function formatDate(iso: string): string {
  if (!isValidIsoDate(iso)) {
    throw new Error(`Data ISO inválida: ${iso}`);
  }
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${d} de ${months[m - 1]} de ${y}`;
}

/**
 * UT-19: Contador de dias entre duas datas ISO.
 * daysSince("2024-01-01", "2024-01-11") => 10
 */
export function daysSince(first: string, today: string): number {
  if (!isValidIsoDate(first) || !isValidIsoDate(today)) {
    throw new Error("Data ISO inválida");
  }
  const [y1, m1, d1] = first.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffMs = t2 - t1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}