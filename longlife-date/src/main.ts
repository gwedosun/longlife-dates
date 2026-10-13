import "./styles.css";
import { isoToBr, parseBrDate } from "./domain/date";
import {
  createEncounter,
  deleteAllData,
  deleteEncounter,
  exportBackup,
  importBackup,
  listEncounters,
  mimeFromFilename,
  readPhoto,
} from "./api/encounters";
import { EncounterStore } from "./state/store";
import type { Encounter } from "./domain/types";

const store = new EncounterStore();

// ============================================================
// Estado local de filtros (fora do store; é só UI)
// ============================================================
let filters: { query: string; fromBr: string; toBr: string } = {
  query: "",
  fromBr: "",
  toBr: "",
};

// ============================================================
// HTML
// ============================================================
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app não encontrado no index.html");

app.innerHTML = `
  <h1>LongLife Date</h1>

  <form id="form">
    <label>Data <input name="dateBr" placeholder="DD/MM/AAAA" required /></label>
    <label>Local <input name="location" placeholder="Local" required maxlength="120" /></label>
    <label>Descrição <textarea name="description" maxlength="5000"></textarea></label>
    <label>Foto (opcional) <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <button type="submit">Salvar</button>
  </form>

  <section id="filters">
    <input id="f-query" placeholder="Buscar em local ou descrição" />
    <input id="f-from" placeholder="De (DD/MM/AAAA)" />
    <input id="f-to" placeholder="Até (DD/MM/AAAA)" />
    <button id="f-clear" type="button">Limpar filtros</button>
  </section>

  <p id="status"></p>
  <ul id="list"></ul>

  <hr />
  <section id="backup">
    <h2>Backup</h2>
    <button id="export" type="button">Exportar backup (.json)</button>
    <label class="file-btn">
      Importar backup
      <input id="import" type="file" accept="application/json" hidden />
    </label>
  </section>

  <hr />
  <section id="danger-zone">
    <h2 style="color:#b00;font-size:1rem;">Zona de perigo</h2>
    <p style="font-size:.85rem;color:#666;">
      Apaga <strong>todos</strong> os encontros e fotos. Não há como desfazer.
    </p>
    <button id="delete-all" type="button" style="background:#b00;">Apagar todos os dados</button>
  </section>
`;

const form = document.querySelector<HTMLFormElement>("#form")!;
const listEl = document.querySelector<HTMLUListElement>("#list")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

const fQuery = document.querySelector<HTMLInputElement>("#f-query")!;
const fFrom = document.querySelector<HTMLInputElement>("#f-from")!;
const fTo = document.querySelector<HTMLInputElement>("#f-to")!;
const fClear = document.querySelector<HTMLButtonElement>("#f-clear")!;

const exportBtn = document.querySelector<HTMLButtonElement>("#export")!;
const importInput = document.querySelector<HTMLInputElement>("#import")!;
const deleteAllBtn = document.querySelector<HTMLButtonElement>("#delete-all")!;

// ============================================================
// Helpers
// ============================================================
async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function showPhotoModal(dataUrl: string, caption: string): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;cursor:zoom-out;padding:1rem;";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText =
    "max-width:90vw;max-height:85vh;object-fit:contain;border-radius:6px;";
  const cap = document.createElement("p");
  cap.textContent = caption;
  cap.style.cssText = "color:white;margin-top:.75rem;font-size:.9rem;";
  overlay.append(img, cap);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

// ============================================================
// Render
// ============================================================
function render(encounters: Encounter[], loading: boolean, error: string | null): void {
  statusEl.textContent = loading ? "Carregando..." : error ? `Erro: ${error}` : "";
  listEl.innerHTML = "";

  for (const e of encounters) {
    const li = document.createElement("li");
    li.dataset.id = String(e.id);

    const text = document.createElement("span");
    text.textContent = `${isoToBr(e.date)} — ${e.location} — ${e.description || "(sem descrição)"}`;
    li.appendChild(text);

    if (e.photoFile) {
      const btnView = document.createElement("button");
      btnView.type = "button";
      btnView.textContent = "ver foto";
      btnView.addEventListener("click", async () => {
        try {
          const b64 = await readPhoto(e.photoFile!);
          const mime = mimeFromFilename(e.photoFile!);
          showPhotoModal(`data:${mime};base64,${b64}`, `${isoToBr(e.date)} — ${e.location}`);
        } catch (err) {
          alert(`Falha ao abrir foto: ${err}`);
        }
      });
      li.appendChild(btnView);
    }

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "apagar";
    btnDel.addEventListener("click", async () => {
      const ok = window.confirm(
        `Apagar o encontro de ${isoToBr(e.date)} em "${e.location}"?`,
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

// ============================================================
// Refresh (aplica filtros)
// ============================================================
async function refresh(): Promise<void> {
  store.setLoading(true);
  try {
    // converte filtros BR → ISO, se preenchidos
    let fromIso: string | undefined;
    let toIso: string | undefined;

    if (filters.fromBr) {
      const p = parseBrDate(filters.fromBr);
      if (!p.ok) throw new Error("Filtro 'De' com data inválida.");
      fromIso = p.iso;
    }
    if (filters.toBr) {
      const p = parseBrDate(filters.toBr);
      if (!p.ok) throw new Error("Filtro 'Até' com data inválida.");
      toIso = p.iso;
    }

    const list = await listEncounters({
      query: filters.query || undefined,
      from: fromIso,
      to: toIso,
      desc: true,
    });
    store.setEncounters(list);
  } catch (err) {
    store.setError(String(err));
  } finally {
    store.setLoading(false);
  }
}

store.subscribe((s) => render(s.encounters, s.loading, s.error));

// ============================================================
// Filtros — botão "Aplicar" implícito: recalcula em cada tecla (debounce simples)
// ============================================================
let debounce: number | undefined;
function scheduleRefresh(): void {
  if (debounce) window.clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    filters = {
      query: fQuery.value,
      fromBr: fFrom.value.trim(),
      toBr: fTo.value.trim(),
    };
    void refresh();
  }, 250);
}

fQuery.addEventListener("input", scheduleRefresh);
fFrom.addEventListener("input", scheduleRefresh);
fTo.addEventListener("input", scheduleRefresh);

fClear.addEventListener("click", () => {
  fQuery.value = "";
  fFrom.value = "";
  fTo.value = "";
  filters = { query: "", fromBr: "", toBr: "" };
  void refresh();
});

// ============================================================
// Form de criação
// ============================================================
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const data = new FormData(form);
  const dateBr = String(data.get("dateBr") ?? "").trim();
  const location = String(data.get("location") ?? "").trim();
  const description = String(data.get("description") ?? "");

  const parsed = parseBrDate(dateBr);
  if (!parsed.ok) {
    alert(parsed.error === "format"
      ? "Formato inválido. Use DD/MM/AAAA."
      : "Essa data não existe no calendário.");
    return;
  }
  if (!location) {
    alert("Local é obrigatório.");
    return;
  }

  let photoBytes: Uint8Array | null = null;
  const file = (form.elements.namedItem("photo") as HTMLInputElement)?.files?.[0];
  if (file) photoBytes = await readFileBytes(file);

  try {
    await createEncounter({ date: parsed.iso, location, description, photoBytes });
    form.reset();
    await refresh();
  } catch (err) {
    alert(String(err));
  }
});

// ============================================================
// Backup — exportar
// ============================================================
exportBtn.addEventListener("click", async () => {
  try {
    const json = await exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `longlife-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Falha ao exportar: ${err}`);
  }
});

// ============================================================
// Backup — importar
// ============================================================
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  const ok = window.confirm(
    "Importar backup vai SUBSTITUIR todos os dados atuais.\n\nDeseja continuar?",
  );
  if (!ok) {
    importInput.value = "";
    return;
  }

  const typed = window.prompt("Digite SUBSTITUIR (maiúsculas) para confirmar:");
  if (typed !== "SUBSTITUIR") {
    alert("Importação cancelada.");
    importInput.value = "";
    return;
  }

  try {
    const text = await file.text();
    const count = await importBackup(text);
    await refresh();
    alert(`Backup restaurado: ${count} encontro(s).`);
  } catch (err) {
    alert(`Falha ao importar: ${err}`);
  } finally {
    importInput.value = "";
  }
});

// ============================================================
// Apagar tudo
// ============================================================
deleteAllBtn.addEventListener("click", async () => {
  const first = window.confirm(
    "Isto vai apagar TODOS os encontros e TODAS as fotos.\n\nTem certeza?",
  );
  if (!first) return;

  const typed = window.prompt("Digite APAGAR (maiúsculas) para confirmar:");
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

// ============================================================
// Boot
// ============================================================
refresh();