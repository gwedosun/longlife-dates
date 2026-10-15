import { describe, it, expect, vi } from "vitest";
import { renderCard } from "./card";
import type { Encounter } from "../domain/types";

const sampleWithPhoto: Encounter = {
  id: 1,
  date: "2024-02-14",
  location: "Cinema",
  description: "Primeiro filme",
  photoFile: "test-photo.jpg",
  createdAt: "2024-02-14T20:00:00Z",
  updatedAt: "2024-02-14T20:00:00Z",
};

const sampleWithoutPhoto: Encounter = {
  id: 2,
  date: "2024-03-01",
  location: "Parque",
  description: "Piquenique",
  photoFile: null,
  createdAt: "2024-03-01T15:00:00Z",
  updatedAt: "2024-03-01T15:00:00Z",
};

describe("renderCard (UT-20, UT-21, UT-22)", () => {
  // ---------- UT-20: Renderização do card ----------
  it("renderiza na ordem DOM: header (data+local) -> img -> descrição (UT-20)", () => {
    const card = renderCard(sampleWithPhoto);

    // Deve ter 3 filhos principais na ordem correta
    const children = Array.from(card.children);
    expect(children.length).toBe(3);

    // 1. Header no topo com data e local
    const header = children[0];
    expect(header.classList.contains("card-header")).toBe(true);
    expect(header.querySelector(".card-date")?.textContent).toBe("14/02/2024");
    expect(header.querySelector(".card-location")?.textContent).toContain("Cinema");

    // 2. Imagem ao centro
    const img = children[1] as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.classList.contains("card-photo")).toBe(true);
    expect(img.alt).toBe("Foto do encontro em Cinema");

    // 3. Descrição e ações na base
    const footer = children[2];
    expect(footer.classList.contains("card-footer")).toBe(true);
    expect(footer.querySelector(".card-description")?.textContent).toBe("Primeiro filme");
  });

  // ---------- UT-21: Card sem foto mostra placeholder ----------
  it("mostra elemento .photo-placeholder quando photoFile é null e não renderiza <img> (UT-21)", () => {
    const card = renderCard(sampleWithoutPhoto);

    const img = card.querySelector("img");
    expect(img).toBeNull();

    const placeholder = card.querySelector(".photo-placeholder");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain("💕");
  });

  // ---------- UT-22: Escape de HTML (anti-XSS) ----------
  it("escapa tags HTML perigosas na descrição sem criar elementos de script no DOM (UT-22)", () => {
    const malicious: Encounter = {
      ...sampleWithoutPhoto,
      description: `<script>alert('xss')</script><b>texto seguro</b>`,
    };

    const card = renderCard(malicious);

    // Não deve existir nó <script> no documento
    expect(card.querySelector("script")).toBeNull();

    // O texto deve conter a string literal sem interpretar como HTML
    const desc = card.querySelector(".card-description");
    expect(desc?.textContent).toBe("<script>alert('xss')</script><b>texto seguro</b>");
    expect(desc?.innerHTML).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;&lt;b&gt;texto seguro&lt;/b&gt;");
  });

  // ---------- Botão de Editar (✏️) ----------
  it("renderiza o botão ✏️ editar e aciona o callback onEdit ao clicar", () => {
    const onEdit = vi.fn();
    const card = renderCard(sampleWithPhoto, { onEdit });

    const btnEdit = card.querySelector(".btn-edit") as HTMLButtonElement;
    expect(btnEdit).not.toBeNull();
    expect(btnEdit.textContent).toContain("✏️ editar");

    btnEdit.click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(sampleWithPhoto);
  });

  // ---------- Botão de Apagar (🗑️) ----------
  it("renderiza o botão 🗑️ apagar e aciona o callback onDelete ao clicar", () => {
    const onDelete = vi.fn();
    const card = renderCard(sampleWithPhoto, { onDelete });

    const btnDel = card.querySelector(".btn-delete") as HTMLButtonElement;
    expect(btnDel).not.toBeNull();
    expect(btnDel.textContent).toContain("🗑️ apagar");

    btnDel.click();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(sampleWithPhoto);
  });

  // ---------- Visualização de Foto ----------
  it("renderiza o botão 'ver foto' e aciona onViewPhoto ao clicar no botão ou na foto", () => {
    const onViewPhoto = vi.fn();
    const card = renderCard(sampleWithPhoto, { onViewPhoto });

    const btnView = card.querySelector(".btn-view-photo") as HTMLButtonElement;
    expect(btnView).not.toBeNull();
    btnView.click();
    expect(onViewPhoto).toHaveBeenCalledTimes(1);

    const img = card.querySelector("img.card-photo") as HTMLImageElement;
    expect(img).not.toBeNull();
    img.click();
    expect(onViewPhoto).toHaveBeenCalledTimes(2);
  });
});

