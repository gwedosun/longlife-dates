import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  renderAuthView,
  validateLoginInput,
  validateRecoveryInput,
  validateSetupInput,
} from "../../src/views/login";
import { bootstrapApp } from "../../src/main";

describe("Autenticação Local, Código de Recuperação e Reset de Fábrica (Vitest + mockIPC)", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    clearMocks();
    document.body.innerHTML = "";
  });

  describe("Validação de campos de Login, Setup e Recuperação", () => {
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

    it("valida entrada de recuperação (código obrigatório e confirmação de nova senha)", () => {
      const emptyCode = validateRecoveryInput("   ", "nova1234", "nova1234");
      expect(emptyCode.valid).toBe(false);
      if (!emptyCode.valid) {
        expect(emptyCode.error).toContain("código de recuperação");
      }

      const mismatch = validateRecoveryInput("abcd-efgh-1234-5678", "nova1234", "outra1234");
      expect(mismatch.valid).toBe(false);

      const ok = validateRecoveryInput(" abcd-efgh-1234-5678 ", "nova1234", "nova1234");
      expect(ok).toEqual({
        valid: true,
        recoveryCode: "ABCD-EFGH-1234-5678",
        newPassword: "nova1234",
      });
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

      toggleBtn.click();
      expect(passwordInput.type).toBe("text");
      toggleBtn.click();
      expect(passwordInput.type).toBe("password");

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

  describe("Primeiro Acesso: Modal de Código de Recuperação, Cópia e Checkbox Obrigatório", () => {
    it("exibe o código de recuperação após setup, copia o código e só libera o botão 'Acessar Lovelog' ao marcar o checkbox", async () => {
      let accountCreated = false;
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextSpy },
        configurable: true,
      });

      mockIPC((cmd, args) => {
        if (cmd === "check_has_account") return accountCreated;
        if (cmd === "setup_account") {
          const payload = args as { password?: string };
          if ((payload?.password?.length ?? 0) >= 4) {
            accountCreated = true;
            return "LOVE-2024-ABCD-9999";
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

      // Aguarda exibição do modal com o Código de Recuperação
      await vi.waitFor(() => {
        expect(appEl.querySelector("#recovery-code-modal")).not.toBeNull();
      });

      const codeDisplay = appEl.querySelector<HTMLElement>("#recovery-code-display")!;
      const copyBtn = appEl.querySelector<HTMLButtonElement>("#copy-recovery-code-btn")!;
      const checkbox = appEl.querySelector<HTMLInputElement>("#confirm-recovery-saved")!;
      const continueBtn = appEl.querySelector<HTMLButtonElement>("#continue-after-recovery-btn")!;

      expect(codeDisplay.textContent).toBe("LOVE-2024-ABCD-9999");

      // Botão "Acessar Lovelog" deve iniciar desabilitado até o checkbox ser marcado
      expect(continueBtn.disabled).toBe(true);

      // Testa clique no botão de copiar código
      copyBtn.click();
      await vi.waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith("LOVE-2024-ABCD-9999");
        expect(copyBtn.textContent).toContain("Código copiado");
      });

      // Marca o checkbox de confirmação e verifica desbloqueio do botão
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      expect(continueBtn.disabled).toBe(false);

      // Clica em "Acessar Lovelog" e verifica transição para a tela principal
      continueBtn.click();
      await vi.waitFor(() => {
        expect(appEl.querySelector("#form")).not.toBeNull();
        expect(appEl.querySelector(".empty-state")?.textContent).toContain(
          "Registre o primeiro encontro",
        );
      });
    });
  });

  describe("Recuperação de Senha e Reset de Fábrica (Esqueci minha senha)", () => {
    it("rejeita código de recuperação inválido e permite redefinir senha e entrar com código válido", async () => {
      mockIPC((cmd, args) => {
        if (cmd === "check_has_account") return true;
        if (cmd === "reset_password_with_recovery_code") {
          const payload = args as { recoveryCode?: string; newPassword?: string };
          if (payload?.recoveryCode === "ABCD-EFGH-1234-5678") {
            return null;
          }
          throw "Código de recuperação inválido";
        }
        if (cmd === "login") return true;
        if (cmd === "list_encounters_cmd") return [];
      });

      const appEl = document.querySelector<HTMLElement>("#app")!;
      await bootstrapApp(appEl);

      // Clica em "Esqueci minha senha" na tela de login
      const forgotBtn = appEl.querySelector<HTMLButtonElement>("#forgot-password-btn")!;
      expect(forgotBtn).not.toBeNull();
      forgotBtn.click();

      expect(appEl.querySelector(".auth-screen")?.getAttribute("data-mode")).toBe("recovery");

      const codeInput = appEl.querySelector<HTMLInputElement>("#recovery-code-input")!;
      const newPassInput = appEl.querySelector<HTMLInputElement>("#recovery-new-password")!;
      const confirmPassInput = appEl.querySelector<HTMLInputElement>("#recovery-confirm-password")!;
      const recoveryForm = appEl.querySelector<HTMLFormElement>("#recovery-form")!;
      const recoveryError = appEl.querySelector<HTMLParagraphElement>("#recovery-error")!;

      // 1. Submete com código inválido -> deve exibir erro
      codeInput.value = "XXXX-0000-YYYY-1111";
      newPassInput.value = "nova-senha-123";
      confirmPassInput.value = "nova-senha-123";
      recoveryForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(recoveryError.style.display).toBe("block");
        expect(recoveryError.textContent).toContain("Código de recuperação inválido");
      });
      expect(appEl.querySelector("#form")).toBeNull();

      // 2. Submete com código válido -> deve redefinir a senha e entrar na tela principal
      codeInput.value = "abcd-efgh-1234-5678";
      recoveryForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(appEl.querySelector("#form")).not.toBeNull();
        expect(appEl.querySelector("#list")).not.toBeNull();
      });
    });

    it("executa o Reset de Fábrica (Estado Zero) após confirmação dupla ('DELETAR') e retorna a view para o Setup inicial", async () => {
      let factoryResetCalled = false;

      mockIPC((cmd) => {
        if (cmd === "check_has_account") return true;
        if (cmd === "factory_reset_unauthenticated") {
          factoryResetCalled = true;
          return null;
        }
      });

      const appEl = document.querySelector<HTMLElement>("#app")!;
      await bootstrapApp(appEl);

      // Abre a tela "Esqueci minha senha"
      appEl.querySelector<HTMLButtonElement>("#forgot-password-btn")!.click();

      // Clica em "Apagar tudo e começar do zero"
      const factoryResetBtn = appEl.querySelector<HTMLButtonElement>("#factory-reset-btn")!;
      factoryResetBtn.click();

      const confirmBox = appEl.querySelector<HTMLDivElement>("#factory-reset-confirm-box")!;
      const confirmInput = appEl.querySelector<HTMLInputElement>("#factory-reset-confirm-input")!;
      const confirmBtn = appEl.querySelector<HTMLButtonElement>("#factory-reset-confirm-btn")!;
      const confirmError = appEl.querySelector<HTMLParagraphElement>("#factory-reset-error")!;

      expect(confirmBox.style.display).toBe("grid");

      // Tenta confirmar sem digitar DELETAR -> deve bloquear e exibir aviso
      confirmInput.value = "apagar";
      confirmBtn.click();
      expect(confirmError.style.display).toBe("block");
      expect(factoryResetCalled).toBe(false);

      // Digita DELETAR e confirma -> deve chamar factory_reset_unauthenticated e voltar para setup
      confirmInput.value = "DELETAR";
      confirmBtn.click();

      await vi.waitFor(() => {
        expect(factoryResetCalled).toBe(true);
        expect(appEl.querySelector(".auth-screen")?.getAttribute("data-mode")).toBe("setup");
        expect(appEl.querySelector("#auth-confirm-password")).not.toBeNull();
      });
    });
  });

  describe("Fluxo completo de Login e Logout via mockIPC", () => {
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

      expect(appEl.querySelector("#auth-form")).not.toBeNull();
      expect(appEl.querySelector("#form")).toBeNull();
      expect(appEl.querySelector("#list")).toBeNull();

      const passwordInput = appEl.querySelector<HTMLInputElement>("#auth-password")!;
      const authForm = appEl.querySelector<HTMLFormElement>("#auth-form")!;
      passwordInput.value = "1234";
      authForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(appEl.querySelector("#form")).not.toBeNull();
        expect(appEl.querySelector("#list")).not.toBeNull();
        expect(appEl.querySelector(".encounter-card")?.textContent).toContain(
          "Cafeteria Pastel",
        );
      });

      const logoutBtn = appEl.querySelector<HTMLButtonElement>("#logout-btn")!;
      logoutBtn.click();

      await vi.waitFor(() => {
        expect(appEl.querySelector("#auth-form")).not.toBeNull();
        expect(appEl.querySelector("#form")).toBeNull();
      });
    });
  });
});
