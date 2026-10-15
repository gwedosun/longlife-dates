import type { Encounter } from "../domain/types";
import { isoToBr } from "../domain/date";

export interface CardActions {
  onEdit?: (encounter: Encounter) => void;
  onDelete?: (encounter: Encounter) => void;
  onViewPhoto?: (encounter: Encounter) => void;
}

/**
 * Renderiza o elemento de card de um encontro (UT-20, UT-21, UT-22).
 * Estrutura:
 * - TOPO (header): data e local
 * - CENTRO: foto (<img>) ou placeholder (.photo-placeholder)
 * - BASE: descrição (segura contra XSS) e botões de ação (✏️ Editar, 🗑️ Apagar)
 */
export function renderCard(encounter: Encounter, actions?: CardActions): HTMLElement {
  const card = document.createElement("li");
  card.className = "encounter-card";
  card.dataset.id = String(encounter.id);

  // 1. TOPO: Header (data + local)
  const header = document.createElement("div");
  header.className = "card-header";

  const dateEl = document.createElement("span");
  dateEl.className = "card-date";
  dateEl.textContent = isoToBr(encounter.date);

  const locEl = document.createElement("span");
  locEl.className = "card-location";
  locEl.textContent = `📍 ${encounter.location}`;

  header.append(dateEl, locEl);
  card.appendChild(header);

  // 2. CENTRO: Foto (img) ou Placeholder (.photo-placeholder)
  if (encounter.photoFile) {
    const img = document.createElement("img");
    img.className = "card-photo";
    img.alt = `Foto do encontro em ${encounter.location}`;
    img.dataset.photo = encounter.photoFile;
    img.src = "";
    if (actions?.onViewPhoto) {
      img.style.cursor = "pointer";
      img.title = "Clique para ampliar";
      img.addEventListener("click", () => actions.onViewPhoto?.(encounter));
    }
    card.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "photo-placeholder";
    placeholder.textContent = "💕";
    card.appendChild(placeholder);
  }

  // 3. BASE: Descrição e Ações
  const footer = document.createElement("div");
  footer.className = "card-footer";

  const descEl = document.createElement("p");
  descEl.className = "card-description";
  // UT-22: textContent garante que qualquer script seja tratado como texto puro (anti-XSS)
  descEl.textContent = encounter.description || "(sem descrição)";
  footer.appendChild(descEl);

  const actionsEl = document.createElement("div");
  actionsEl.className = "card-actions";

  // Botão Ver foto (se tiver foto)
  if (encounter.photoFile && actions?.onViewPhoto) {
    const btnView = document.createElement("button");
    btnView.type = "button";
    btnView.className = "btn-view-photo";
    btnView.textContent = "ver foto";
    btnView.addEventListener("click", () => actions.onViewPhoto?.(encounter));
    actionsEl.appendChild(btnView);
  }

  // Botão ✏️ Editar (Prioridade Máxima)
  const btnEdit = document.createElement("button");
  btnEdit.type = "button";
  btnEdit.className = "btn-edit";
  btnEdit.textContent = "✏️ editar";
  btnEdit.setAttribute("aria-label", `Editar encontro em ${encounter.location}`);
  if (actions?.onEdit) {
    btnEdit.addEventListener("click", () => actions.onEdit?.(encounter));
  }
  actionsEl.appendChild(btnEdit);

  // Botão 🗑️ Apagar
  const btnDel = document.createElement("button");
  btnDel.type = "button";
  btnDel.className = "btn-delete";
  btnDel.textContent = "🗑️ apagar";
  btnDel.setAttribute("aria-label", `Apagar encontro em ${encounter.location}`);
  if (actions?.onDelete) {
    btnDel.addEventListener("click", () => actions.onDelete?.(encounter));
  }
  actionsEl.appendChild(btnDel);

  footer.appendChild(actionsEl);
  card.appendChild(footer);

  return card;
}

