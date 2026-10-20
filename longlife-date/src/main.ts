import "@fontsource/pacifico";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./styles.css";
import { isoToBr, parseBrDate } from "./domain/date";
import { checkHasAccount, logout } from "./api/auth";
import {
  createEncounter,
  deleteAllData,
  deleteEncounter,
  exportBackup,
  importBackup,
  listEncounters,
  mimeFromFilename,
  readPhoto,
  updateEncounter,
} from "./api/encounters";
import { EncounterStore } from "./state/store";
import type { Encounter } from "./domain/types";
import { renderCard } from "./views/card";
import { renderAuthView } from "./views/login";
import { validateForm } from "./domain/form";

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

/**
 * Renderiza a tela principal do aplicativo (formulário + timeline) somente após autenticação.
 */
export async function mountMainView(app: HTMLElement): Promise<void> {
  const store = new EncounterStore();

  let editingId: number | null = null;
  let sortDesc = false; // ordem crescente (ASC)

  let filters: { query: string; fromBr: string; toBr: string } = {
    query: "",
    fromBr: "",
    toBr: "",
  };

  app.innerHTML = `
    <header class="app-topbar">
      <h1>lovelog</h1>
      <button id="logout-btn" type="button" title="Bloquear diário e voltar à tela de senha">
        🔒 Bloquear / Sair
      </button>
    </header>

    <div id="editing-banner" style="display:none;align-items:center;justify-content:space-between;margin-bottom:0.75rem;padding:0.6rem 1rem;background:var(--tint-lavender);border:var(--border) solid var(--line-lavender);border-radius:var(--radius-md);">
      <span>✏️ <strong>Editando encontro:</strong> <span id="editing-info"></span></span>
      <button id="cancel-edit" type="button" style="padding:0.3rem 0.75rem;font-size:var(--fs-small);background:var(--tint-peach);">Cancelar edição</button>
    </div>

    <form id="form">
      <label>Data <input name="dateBr" placeholder="DD/MM/AAAA" required /></label>
      <label>Local <input name="location" placeholder="Local" required maxlength="120" /></label>
      <label>Descrição <textarea name="description" maxlength="5000"></textarea></label>
      <label>Foto (opcional) <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <button id="submit-btn" type="submit">Salvar</button>
    </form>

    <section id="filters">
      <input id="f-query" placeholder="Buscar em local ou descrição" />
      <input id="f-from" placeholder="De (DD/MM/AAAA)" />
      <input id="f-to" placeholder="Até (DD/MM/AAAA)" />
      <button id="f-order" type="button" title="Alternar ordenação cronológica">⬆️ Antigos primeiro (ASC)</button>
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

  const logoutBtn = app.querySelector<HTMLButtonElement>("#logout-btn")!;
  const form = app.querySelector<HTMLFormElement>("#form")!;
  const submitBtn = app.querySelector<HTMLButtonElement>("#submit-btn")!;
  const editingBanner = app.querySelector<HTMLDivElement>("#editing-banner")!;
  const editingInfo = app.querySelector<HTMLSpanElement>("#editing-info")!;
  const cancelEditBtn = app.querySelector<HTMLButtonElement>("#cancel-edit")!;

  const listEl = app.querySelector<HTMLUListElement>("#list")!;
  const statusEl = app.querySelector<HTMLParagraphElement>("#status")!;

  const fQuery = app.querySelector<HTMLInputElement>("#f-query")!;
  const fFrom = app.querySelector<HTMLInputElement>("#f-from")!;
  const fTo = app.querySelector<HTMLInputElement>("#f-to")!;
  const fOrder = app.querySelector<HTMLButtonElement>("#f-order")!;
  const fClear = app.querySelector<HTMLButtonElement>("#f-clear")!;

  const exportBtn = app.querySelector<HTMLButtonElement>("#export")!;
  const importInput = app.querySelector<HTMLInputElement>("#import")!;
  const deleteAllBtn = app.querySelector<HTMLButtonElement>("#delete-all")!;

  logoutBtn.addEventListener("click", async () => {
    try {
      await logout();
    } finally {
      app.innerHTML = "";
      app.appendChild(
        renderAuthView({
          mode: "login",
          onAuthenticated: () => mountMainView(app),
        }),
      );
    }
  });

  function resetEditState(): void {
    editingId = null;
    form.reset();
    submitBtn.textContent = "Salvar";
    editingBanner.style.display = "none";
    editingInfo.textContent = "";
  }

  cancelEditBtn.addEventListener("click", resetEditState);

  function render(encounters: Encounter[], loading: boolean, error: string | null): void {
    statusEl.textContent = loading ? "Carregando..." : error ? `Erro: ${error}` : "";
    listEl.innerHTML = "";

    if (!loading && !error && encounters.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Registre o primeiro encontro de vocês 💕";
      listEl.appendChild(empty);
      return;
    }

    for (const e of encounters) {
      const card = renderCard(e, {
        onEdit: (encounter) => {
          editingId = encounter.id;
          (form.elements.namedItem("dateBr") as HTMLInputElement).value = isoToBr(encounter.date);
          (form.elements.namedItem("location") as HTMLInputElement).value = encounter.location;
          (form.elements.namedItem("description") as HTMLTextAreaElement).value =
            encounter.description;
          submitBtn.textContent = "Atualizar encontro";
          editingInfo.textContent = `${isoToBr(encounter.date)} — ${encounter.location}`;
          editingBanner.style.display = "flex";
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          (form.elements.namedItem("location") as HTMLInputElement).focus();
        },
        onDelete: async (encounter) => {
          const ok = window.confirm(
            `Apagar o encontro de ${isoToBr(encounter.date)} em "${encounter.location}"?`,
          );
          if (!ok) return;
          try {
            await deleteEncounter(encounter.id);
            if (editingId === encounter.id) {
              resetEditState();
            }
            await refresh();
          } catch (err) {
            alert(`Falha ao apagar: ${err}`);
          }
        },
        onViewPhoto: async (encounter) => {
          if (!encounter.photoFile) return;
          try {
            const b64 = await readPhoto(encounter.photoFile);
            const mime = mimeFromFilename(encounter.photoFile);
            showPhotoModal(
              `data:${mime};base64,${b64}`,
              `${isoToBr(encounter.date)} — ${encounter.location}`,
            );
          } catch (err) {
            alert(`Falha ao abrir foto: ${err}`);
          }
        },
      });

      if (e.photoFile) {
        const imgEl = card.querySelector<HTMLImageElement>("img.card-photo");
        if (imgEl) {
          readPhoto(e.photoFile)
            .then((b64) => {
              const mime = mimeFromFilename(e.photoFile!);
              imgEl.src = `data:${mime};base64,${b64}`;
            })
            .catch(() => {
              // Se falhar a miniatura, não bloqueia a UI
            });
        }
      }

      listEl.appendChild(card);
    }
  }

  async function refresh(): Promise<void> {
    store.setLoading(true);
    try {
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
        desc: sortDesc,
      });
      store.setEncounters(list);
    } catch (err) {
      store.setError(String(err));
    } finally {
      store.setLoading(false);
    }
  }

  store.subscribe((s) => render(s.encounters, s.loading, s.error));

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

  fOrder.addEventListener("click", () => {
    sortDesc = !sortDesc;
    fOrder.textContent = sortDesc
      ? "⬇️ Recentes primeiro (DESC)"
      : "⬆️ Antigos primeiro (ASC)";
    void refresh();
  });

  fClear.addEventListener("click", () => {
    fQuery.value = "";
    fFrom.value = "";
    fTo.value = "";
    filters = { query: "", fromBr: "", toBr: "" };
    void refresh();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = new FormData(form);
    const dateBr = String(data.get("dateBr") ?? "").trim();
    const location = String(data.get("location") ?? "").trim();
    const description = String(data.get("description") ?? "");
    const file = (form.elements.namedItem("photo") as HTMLInputElement)?.files?.[0];

    const validation = validateForm({
      dateBr,
      location,
      description,
      photo: file ? { size: file.size, type: file.type } : null,
    });

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      alert(firstError);
      return;
    }

    let photoBytes: Uint8Array | null = null;
    if (file) {
      photoBytes = await readFileBytes(file);
    }

    try {
      if (editingId !== null) {
        await updateEncounter({
          id: editingId,
          date: validation.data.dateIso,
          location: validation.data.location,
          description: validation.data.description,
          newPhotoBytes: photoBytes,
        });
        resetEditState();
      } else {
        await createEncounter({
          date: validation.data.dateIso,
          location: validation.data.location,
          description: validation.data.description,
          photoBytes,
        });
        form.reset();
      }
      await refresh();
    } catch (err) {
      alert(`Erro ao salvar: ${err}`);
    }
  });

  exportBtn.addEventListener("click", async () => {
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `lovelog-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Falha ao exportar: ${err}`);
    }
  });

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
      if (editingId !== null) resetEditState();
      await refresh();
      alert(`Backup restaurado: ${count} encontro(s).`);
    } catch (err) {
      alert(`Falha ao importar: ${err}`);
    } finally {
      importInput.value = "";
    }
  });

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
      if (editingId !== null) resetEditState();
      await refresh();
      alert("Todos os dados foram apagados.");
    } catch (err) {
      alert(`Falha ao apagar: ${err}`);
    }
  });

  await refresh();
}

/**
 * Inicializa o fluxo de autenticação local antes de montar a tela principal.
 */
export async function bootstrapApp(targetApp?: HTMLElement): Promise<void> {
  const app = targetApp ?? document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = "";
  const hasAccount = await checkHasAccount();

  const authView = renderAuthView({
    mode: hasAccount ? "login" : "setup",
    onAuthenticated: () => mountMainView(app),
  });

  app.appendChild(authView);
}

// Inicialização automática quando #app está presente no DOM
const defaultApp = document.querySelector<HTMLDivElement>("#app");
if (defaultApp) {
  void bootstrapApp(defaultApp);
}
