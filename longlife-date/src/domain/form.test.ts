import { describe, it, expect } from "vitest";
import { validateForm, MAX_PHOTO_BYTES } from "./form";

// ---------- UT-23: Validação do formulário (TS) ----------
describe("validateForm (UT-23 / RN01-RN04)", () => {
  it("valida formulário preenchido corretamente sem foto", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "Cinema",
      description: "Primeiro filme",
    });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.data.dateIso).toBe("2024-02-14");
      expect(res.data.location).toBe("Cinema");
      expect(res.data.description).toBe("Primeiro filme");
    }
  });

  it("rejeita local vazio ou só espaços (RN02 / UT-23)", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "   ",
      description: "Teste",
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.location).toBe("Local é obrigatório.");
    }
  });

  it("rejeita local com mais de 120 caracteres (RN02)", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "A".repeat(121),
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.location).toBe("Local deve ter no máximo 120 caracteres.");
    }
  });

  it("rejeita data inválida ou formato incorreto (RN01)", () => {
    const resFormat = validateForm({
      dateBr: "2024-02-14",
      location: "Praça",
    });
    expect(resFormat.valid).toBe(false);
    if (!resFormat.valid) {
      expect(resFormat.errors.date).toBe("Formato inválido. Use DD/MM/AAAA.");
    }

    const resNonexistent = validateForm({
      dateBr: "29/02/2023",
      location: "Praça",
    });
    expect(resNonexistent.valid).toBe(false);
    if (!resNonexistent.valid) {
      expect(resNonexistent.errors.date).toBe("Essa data não existe no calendário.");
    }
  });

  it("rejeita descrição com mais de 5000 caracteres (RN03)", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "Parque",
      description: "X".repeat(5001),
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.description).toBe("Descrição deve ter no máximo 5000 caracteres.");
    }
  });

  it("rejeita foto maior que 10 MB (RN04)", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "Parque",
      photo: { size: MAX_PHOTO_BYTES + 1, type: "image/png" },
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.photo).toBe("Foto muito grande. Tamanho máximo: 10 MB.");
    }
  });

  it("rejeita foto de formato inválido (RN04)", () => {
    const res = validateForm({
      dateBr: "14/02/2024",
      location: "Parque",
      photo: { size: 1024, type: "image/gif" },
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.photo).toBe("Formato de foto inválido. Use JPEG, PNG ou WebP.");
    }
  });

  it("aceita formatos válidos de foto (RN04)", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const res = validateForm({
        dateBr: "14/02/2024",
        location: "Parque",
        photo: { size: 1024, type },
      });
      expect(res.valid).toBe(true);
    }
  });
});

