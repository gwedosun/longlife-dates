import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  renderAuthView,
  validateLoginInput,
  validateSetupInput,
} from "../../src/views/login";
import { bootstrapApp } from "../../src/main";

describe("Autenticação Local — Validações e Fluxo de UI (Vitest + mockIPC)", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    clearMocks();
    document.body.innerHTML = "";
  });

  describe("Validação de campos de Login e Primeiro Acesso", () => {
    it("rejeita senha vazia ou apenas espaços no login e no setup", () => {
      const loginEmpty = validateLoginInput("   ");
      expect(loginEmpty.valid).toBe(false);
      if (!loginEmpty.valid) {
        expect(loginEmpty.error).toContain("Informe sua senha");
      }

      const setupEmpty = validateSetupInput("", "");
      expect(setupEmpty.valid).toBe(false);
      if (!setupEmpty.valid) {
        expect(setupEmpty.error).toContain("Defina uma senha");
      }
    });

    it("rejeita senha com menos de 4 caracteres", () => {
      const resLogin = validateLoginInput("123");
      expect(resLogin.valid).toBe(false);
      if (!resLogin.valid) {
        expect(resLogin.error).toContain("pelo menos 4 caracteres");
      }

      const resSetup = validateSetupInput("abc", "abc");
      expect(resSetup.valid).toBe(false);
      if (!resSetup.valid) {
        expect(resSetup.error).toContain("pelo menos 4 caracteres");
      }
    });

    it("rejeita senhas que não coincidem no cadastro de primeiro acesso", () => {
      const res = validateSetupInput("amor2024", "amor2025");
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toBe("As senhas não coincidem.");
      }
    });

    it("aceita senhas válidas e coincidentes", () => {
      const resSetup = validateSetupInput("segredo123", "segredo123");
      expect(resSetup).toEqual({ valid: true, password: "segredo123" });

      const resLogin = validateLoginInput("segredo123");
      expect(resLogin).toEqual({ valid: true, password: "segredo123" });
    });
  });

  describe("Renderização da tela de Login / Setup e exibição de erros", () => {
    it("renderiza tela de login com botão de exibir/ocultar senha e exibe erro ao falhar", async () => {
      mockIPC((cmd, args) => {
        if (cmd === "login") {
          const payload = args as { password?: string };
          if (payload?.password !== "senha-certa") {
            throw "Senha incorreta. Tente novamente.";
          }
          return true;
        }
      });

      const onAuthenticated = vi.fn();
      const view = renderAuthView({ mode: "login", onAuthenticated });
      document.body.appendChild(view);

      const passwordInput = view.querySelector<HTMLInputElement>("#auth-password")!;
      const toggleBtn = view.querySelector<HTMLButtonElement>("#toggle-password")!;
      const submitBtn = view.querySelector<HTMLButtonElement>("#auth-submit")!;
      const errorEl = view.querySelector<HTMLParagraphElement>("#auth-error")!;
      const form = view.querySelector<HTMLFormElement>("#auth-form")!;

      expect(passwordInput.type).toBe("password");
      expect(submitBtn.textContent).toContain("Desbloquear Lovelog");

      // Testa alternância mostrar/ocultar senha
      toggleBtn.click();
      expect(passwordInput.type).toBe("text");
      toggleBtn.click();
      expect(passwordInput.type).toBe("password");

      // Tenta submeter senha incorreta
      passwordInput.value = "errada";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(errorEl.style.display).toBe("block");
        expect(errorEl.textContent).toContain("Senha incorreta");
      });
      expect(onAuthenticated).not.toHaveBeenCalled();
    });

    it("exibe erro na UI de primeiro acesso quando as senhas não coincidem", async () => {
      const onAuthenticated = vi.fn();
      const view = renderAuthView({ mode: "setup", onAuthenticated });
      document.body.appendChild(view);

      const passwordInput = view.querySelector<HTMLInputElement>("#auth-password")!;
      const confirmInput = view.querySelector<HTMLInputElement>("#auth-confirm-password")!;
      const errorEl = view.querySelector<HTMLParagraphElement>("#auth-error")!;
      const form = view.querySelector<HTMLFormElement>("#auth-form")!;

      passwordInput.value = "123456";
      confirmInput.value = "654321";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      expect(errorEl.style.display).toBe("block");
      expect(errorEl.textContent).toBe("As senhas não coincidem.");
      expect(onAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe("Fluxo completo e transição para a tela inicial via mockIPC", () => {
    it("transiciona da tela de login para a timeline após login bem-sucedido e permite bloquear novamente", async () => {
      mockIPC((cmd, args) => {
        if (cmd === "check_has_account") return true;
        if (cmd === "login") {
          const payload = args as { password?: string };
          if (payload?.password === "1234") return true;
          throw "Senha incorreta. Tente novamente.";
        }
        if (cmd === "list_encounters_cmd") {
          return [
            {
              id: 1,
              date: "2024-06-12",
              location: "Cafeteria Pastel",
              description: "Café da tarde especial",
              photoFile: null,
              createdAt: "2024-06-12T15:00:00Z",
              updatedAt: "2024-06-12T15:00:00Z",
            },
          ];
        }
        if (cmd === "logout") return null;
      });

      const appEl = document.querySelector<HTMLElement>("#app")!;
      await bootstrapApp(appEl);

      // Antes do login: deve exibir tela de autenticação e NÃO deve exibir formulário ou lista de encontros
      expect(appEl.querySelector("#auth-form")).not.toBeNull();
      expect(appEl.querySelector("#form")).toBeNull();
      expect(appEl.querySelector("#list")).toBeNull();

      // Preenche a senha correta e envia o login
      const passwordInput = appEl.querySelector<HTMLInputElement>("#auth-password")!;
      const authForm = appEl.querySelector<HTMLFormElement>("#auth-form")!;
      passwordInput.value = "1234";
      authForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      // Aguarda transição para a tela principal com formulário e timeline carregada
      await vi.waitFor(() => {
        expect(appEl.querySelector("#form")).not.toBeNull();
        expect(appEl.querySelector("#list")).not.toBeNull();
        expect(appEl.querySelector(".encounter-card")?.textContent).toContain(
          "Cafeteria Pastel",
        );
      });

      // Clica no botão discreto de "Bloquear / Sair" e verifica retorno à tela de login
      const logoutBtn = appEl.querySelector<HTMLButtonElement>("#logout-btn")!;
      expect(logoutBtn).not.toBeNull();
      logoutBtn.click();

      await vi.waitFor(() => {
        expect(appEl.querySelector("#auth-form")).not.toBeNull();
        expect(appEl.querySelector("#form")).toBeNull();
      });
    });

    it("renderiza tela de Primeiro Acesso quando check_has_account retorna false e entra após configurar senha", async () => {
      let accountCreated = false;

      mockIPC((cmd, args) => {
        if (cmd === "check_has_account") return accountCreated;
        if (cmd === "setup_account") {
          const payload = args as { password?: string };
          if ((payload?.password?.length ?? 0) >= 4) {
            accountCreated = true;
            return null;
          }
          throw "A senha deve ter pelo menos 4 caracteres";
        }
        if (cmd === "login") return true;
        if (cmd === "list_encounters_cmd") return [];
      });

      const appEl = document.querySelector<HTMLElement>("#app")!;
      await bootstrapApp(appEl);

      expect(appEl.querySelector(".auth-screen")?.getAttribute("data-mode")).toBe("setup");

      const passwordInput = appEl.querySelector<HTMLInputElement>("#auth-password")!;
      const confirmInput = appEl.querySelector<HTMLInputElement>("#auth-confirm-password")!;
      const authForm = appEl.querySelector<HTMLFormElement>("#auth-form")!;

      passwordInput.value = "minha-senha";
      confirmInput.value = "minha-senha";
      authForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(accountCreated).toBe(true);
        expect(appEl.querySelector("#form")).not.toBeNull();
        expect(appEl.querySelector(".empty-state")?.textContent).toContain(
          "Registre o primeiro encontro",
        );
      });
    });
  });
});

