import "./styles.css";
import { isoToBr, parseBrDate } from "./domain/date";
import {
  createEncounter,
  deleteEncounter,
  deleteAllData,
  listEncounters,
  mimeFromFilename,
  readPhoto,
} from "./api/encounters";
import { EncounterStore } from "./state/store";
import type { Encounter } from "./domain/types";

const store = new EncounterStore();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app não encontrado no index.html");

app.innerHTML = `
  <h1>LongLife Date</h1>

  <form id="form">
    <label>Data
      <input name="dateBr" placeholder="DD/MM/AAAA" required />
    </label>
    <label>Local
      <input name="location" placeholder="Local" required maxlength="120" />
    </label>
    <label>Descrição
      <textarea name="description" maxlength="5000"></textarea>
    </label>
    <label>Foto (opcional)
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
    </label>
    <button type="submit">Salvar</button>
  </form>

  <p id="status"></p>
  <ul id="list"></ul>

  <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e5e5e5;" />
<section id="danger-zone">
  <h2 style="color: #b00; font-size: 1rem;">Zona de perigo</h2>
  <p style="font-size: 0.85rem; color: #666;">
    Apaga <strong>todos</strong> os encontros e fotos. Não há como desfazer.
  </p>
  <button id="delete-all" type="button" style="background:#b00;">Apagar todos os dados</button>
</section>


`;

const form = document.querySelector<HTMLFormElement>("#form")!;
const listEl = document.querySelector<HTMLUListElement>("#list")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

// ---- modal de visualização ----
function showPhotoModal(dataUrl: string, caption: string): void {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; z-index: 1000; cursor: zoom-out; padding: 1rem;
  `;

  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText =
    "max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 6px;";

  const cap = document.createElement("p");
  cap.textContent = caption;
  cap.style.cssText = "color: white; margin-top: 0.75rem; font-size: 0.9rem;";

  overlay.appendChild(img);
  overlay.appendChild(cap);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

// ---- render ----
function render(encounters: Encounter[], loading: boolean, error: string | null): void {
  statusEl.textContent = loading
    ? "Carregando..."
    : error
      ? `Erro: ${error}`
      : "";

  listEl.innerHTML = "";

  for (const e of encounters) {
    const li = document.createElement("li");
    li.dataset.id = String(e.id);

    const text = document.createElement("span");
    text.textContent = `${isoToBr(e.date)} — ${e.location} — ${
      e.description || "(sem descrição)"
    }`;
    li.appendChild(text);

    // ---- botão "ver foto" ----
    if (e.photoFile) {
      const btnView = document.createElement("button");
      btnView.type = "button";
      btnView.textContent = "ver foto";
      btnView.addEventListener("click", async () => {
        try {
          const b64 = await readPhoto(e.photoFile!);
          const mime = mimeFromFilename(e.photoFile!);
          showPhotoModal(
            `data:${mime};base64,${b64}`,
            `${isoToBr(e.date)} — ${e.location}`,
          );
        } catch (err) {
          alert(`Falha ao abrir foto: ${err}`);
        }
      });
      li.appendChild(btnView);
    }

    // ---- botão "apagar" ----
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "apagar";
    btnDel.addEventListener("click", async () => {
      const ok = window.confirm(
        `Apagar o encontro de ${isoToBr(e.date)} em "${e.location}"? Esta ação não pode ser desfeita.`,
      );
      if (!ok) return;

      try {
        await deleteEncounter(e.id);
        await refresh();
      } catch (err) {
        alert(`Falha ao apagar: ${err}`);
      }
    });
    li.appendChild(btnDel);

    listEl.appendChild(li);
  }
}

async function refresh(): Promise<void> {
  store.setLoading(true);
  try {
    const list = await listEncounters(true);
    store.setEncounters(list);
  } catch (err) {
    store.setError(String(err));
  } finally {
    store.setLoading(false);
  }
}

store.subscribe((s) => render(s.encounters, s.loading, s.error));

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const data = new FormData(form);
  const dateBr = String(data.get("dateBr") ?? "").trim();
  const location = String(data.get("location") ?? "").trim();
  const description = String(data.get("description") ?? "");

  const parsed = parseBrDate(dateBr);
  if (!parsed.ok) {
    alert(
      parsed.error === "format"
        ? "Formato inválido. Use DD/MM/AAAA."
        : "Essa data não existe no calendário.",
    );
    return;
  }
  const iso = parsed.iso;

  if (location.length === 0) {
    alert("Local é obrigatório.");
    return;
  }

  let photoBytes: Uint8Array | null = null;
  const fileInput = form.elements.namedItem("photo") as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (file) {
    photoBytes = await readFileBytes(file);
  }

  try {
    await createEncounter({ date: iso, location, description, photoBytes });
    form.reset();
    await refresh();
  } catch (err) {
    alert(String(err));
  }
});

refresh();

// ============================================================
// Zona de perigo — apagar tudo (dupla confirmação)
// ============================================================
const deleteAllBtn = document.querySelector<HTMLButtonElement>("#delete-all")!;

deleteAllBtn.addEventListener("click", async () => {
  const first = window.confirm(
    "Isto vai apagar TODOS os encontros e TODAS as fotos.\n\nTem certeza que deseja continuar?",
  );
  if (!first) return;

  const typed = window.prompt(
    'Para confirmar, digite exatamente a palavra APAGAR (em maiúsculas):',
  );
  if (typed !== "APAGAR") {
    alert("Confirmação cancelada. Nada foi apagado.");
    return;
  }

  try {
    await deleteAllData();
    await refresh();
    alert("Todos os dados foram apagados.");
  } catch (err) {
    alert(`Falha ao apagar: ${err}`);
  }
});