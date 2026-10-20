import { login, setupAccount } from "../api/auth";

export const MIN_PASSWORD_LENGTH = 4;

export type ValidationResult =
  | { valid: true; password: string }
  | { valid: false; error: string };

export function validateLoginInput(password: string): ValidationResult {
  if (!password || password.trim().length === 0) {
    return { valid: false, error: "Informe sua senha para desbloquear." };
  }
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  return { valid: true, password };
}

export function validateSetupInput(
  password: string,
  confirmPassword: string,
): ValidationResult {
  if (!password || password.trim().length === 0) {
    return {
      valid: false,
      error: "Defina uma senha para proteger seu diário.",
    };
  }
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (password !== confirmPassword) {
    return {
      valid: false,
      error: "As senhas não coincidem.",
    };
  }
  return { valid: true, password };
}

export interface AuthViewOptions {
  mode: "login" | "setup";
  onAuthenticated: () => void | Promise<void>;
}

export function renderAuthView(options: AuthViewOptions): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "auth-screen";
  wrapper.dataset.mode = options.mode;

  const isSetup = options.mode === "setup";

  wrapper.innerHTML = `
    <div class="auth-header">
      <h1>lovelog</h1>
      <p class="auth-subtitle">
        ${
          isSetup
            ? "Primeiro acesso · Configure uma senha local para proteger suas memórias 💕"
            : "Diário bloqueado · Digite sua senha para acessar seus encontros 🔒"
        }
      </p>
    </div>

    <form id="auth-form" class="auth-card" novalidate>
      <h2>${isSetup ? "Configurar Senha" : "Desbloquear Lovelog"}</h2>

      <label for="auth-password">
        ${isSetup ? "Defina sua senha" : "Senha ou PIN"}
        <div class="password-field-wrapper">
          <input
            id="auth-password"
            name="password"
            type="password"
            placeholder="${isSetup ? "Mínimo de 4 caracteres" : "Digite sua senha"}"
            autocomplete="${isSetup ? "new-password" : "current-password"}"
            required
          />
          <button
            id="toggle-password"
            type="button"
            class="btn-toggle-password"
            aria-label="Exibir ou ocultar senha"
          >👁️ Mostrar</button>
        </div>
      </label>

      ${
        isSetup
          ? `
      <label for="auth-confirm-password">
        Confirme sua senha
        <input
          id="auth-confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Repita sua senha"
          autocomplete="new-password"
          required
        />
      </label>
      `
          : ""
      }

      <p id="auth-error" class="auth-error" role="alert" style="display:none;"></p>

      <button id="auth-submit" type="submit">
        ${isSetup ? "Salvar senha e entrar" : "Desbloquear Lovelog"}
      </button>
    </form>
  `;

  const form = wrapper.querySelector<HTMLFormElement>("#auth-form")!;
  const passwordInput = wrapper.querySelector<HTMLInputElement>("#auth-password")!;
  const confirmInput = wrapper.querySelector<HTMLInputElement>("#auth-confirm-password");
  const toggleBtn = wrapper.querySelector<HTMLButtonElement>("#toggle-password")!;
  const errorEl = wrapper.querySelector<HTMLParagraphElement>("#auth-error")!;
  const submitBtn = wrapper.querySelector<HTMLButtonElement>("#auth-submit")!;

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function clearError(): void {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }

  toggleBtn.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    const nextType = showing ? "password" : "text";
    passwordInput.type = nextType;
    if (confirmInput) {
      confirmInput.type = nextType;
    }
    toggleBtn.textContent = showing ? "👁️ Mostrar" : "🙈 Ocultar";
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearError();

    const password = passwordInput.value;

    if (isSetup) {
      const confirmPassword = confirmInput?.value ?? "";
      const validation = validateSetupInput(password, confirmPassword);
      if (!validation.valid) {
        showError(validation.error);
        return;
      }

      submitBtn.disabled = true;
      try {
        await setupAccount(validation.password);
        const logged = await login(validation.password);
        if (logged !== false) {
          await options.onAuthenticated();
        } else {
          showError("Não foi possível iniciar a sessão.");
        }
      } catch (err) {
        showError(String(err));
      } finally {
        submitBtn.disabled = false;
      }
    } else {
      const validation = validateLoginInput(password);
      if (!validation.valid) {
        showError(validation.error);
        return;
      }

      submitBtn.disabled = true;
      try {
        const ok = await login(validation.password);
        if (ok) {
          await options.onAuthenticated();
        } else {
          showError("Senha incorreta. Tente novamente.");
        }
      } catch (err) {
        showError(String(err));
      } finally {
        submitBtn.disabled = false;
      }
    }
  });

  return wrapper;
}

