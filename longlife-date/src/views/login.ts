import {
  factoryResetUnauthenticated,
  login,
  resetPasswordWithRecoveryCode,
  setupAccount,
} from "../api/auth";

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

export function validateRecoveryInput(
  recoveryCode: string,
  newPassword: string,
  confirmNewPassword: string,
): { valid: true; recoveryCode: string; newPassword: string } | { valid: false; error: string } {
  if (!recoveryCode || recoveryCode.trim().length === 0) {
    return {
      valid: false,
      error: "Informe o código de recuperação.",
    };
  }
  const pwdCheck = validateSetupInput(newPassword, confirmNewPassword);
  if (!pwdCheck.valid) {
    return pwdCheck;
  }
  return {
    valid: true,
    recoveryCode: recoveryCode.trim().toUpperCase(),
    newPassword: pwdCheck.password,
  };
}

export interface AuthViewOptions {
  mode: "login" | "setup" | "recovery";
  onAuthenticated: () => void | Promise<void>;
}

export function renderAuthView(options: AuthViewOptions): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "auth-screen";

  function renderMode(currentMode: "login" | "setup" | "recovery"): void {
    wrapper.dataset.mode = currentMode;

    if (currentMode === "recovery") {
      renderRecoveryScreen();
      return;
    }

    const isSetup = currentMode === "setup";

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

        <div class="auth-actions">
          <button id="auth-submit" type="submit">
            ${isSetup ? "Salvar senha" : "Desbloquear Lovelog"}
          </button>

          ${
            !isSetup
              ? `<button id="forgot-password-btn" type="button" class="btn-forgot-password">
                  Esqueci minha senha
                </button>`
              : ""
          }
        </div>
      </form>
    `;

    const form = wrapper.querySelector<HTMLFormElement>("#auth-form")!;
    const passwordInput = wrapper.querySelector<HTMLInputElement>("#auth-password")!;
    const confirmInput = wrapper.querySelector<HTMLInputElement>("#auth-confirm-password");
    const toggleBtn = wrapper.querySelector<HTMLButtonElement>("#toggle-password")!;
    const errorEl = wrapper.querySelector<HTMLParagraphElement>("#auth-error")!;
    const submitBtn = wrapper.querySelector<HTMLButtonElement>("#auth-submit")!;
    const forgotBtn = wrapper.querySelector<HTMLButtonElement>("#forgot-password-btn");

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

    if (forgotBtn) {
      forgotBtn.addEventListener("click", () => {
        renderMode("recovery");
      });
    }

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
          const recoveryCode = await setupAccount(validation.password);
          renderRecoveryCodeModal(recoveryCode || "XXXX-XXXX-XXXX-XXXX", validation.password);
        } catch (err) {
          showError(String(err));
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
  }

  function renderRecoveryCodeModal(recoveryCode: string, passwordForLogin: string): void {
    wrapper.dataset.mode = "setup-recovery-code";

    wrapper.innerHTML = `
      <div class="auth-header">
        <h1>lovelog</h1>
        <p class="auth-subtitle">Guarde seu Código de Recuperação Único 🔐</p>
      </div>

      <div id="recovery-code-modal" class="auth-card recovery-code-card" role="dialog" aria-labelledby="recovery-modal-title">
        <h2 id="recovery-modal-title">Código de Recuperação</h2>

        <p class="recovery-warning">
          Anote ou salve este código em local seguro. Por ser um aplicativo offline, este é o único meio de recuperar seu acesso sem perder seus registros.
        </p>

        <div class="recovery-code-box">
          <code id="recovery-code-display">${recoveryCode}</code>
          <button id="copy-recovery-code-btn" type="button" class="btn-copy-code">
            📋 Copiar Código
          </button>
        </div>

        <label class="recovery-checkbox-label" for="confirm-recovery-saved">
          <input id="confirm-recovery-saved" type="checkbox" />
          <span>Confirmo que salvei meu código de recuperação</span>
        </label>

        <p id="recovery-modal-error" class="auth-error" role="alert" style="display:none;"></p>

        <button id="continue-after-recovery-btn" type="button" disabled>
          Acessar Lovelog
        </button>
      </div>
    `;

    const copyBtn = wrapper.querySelector<HTMLButtonElement>("#copy-recovery-code-btn")!;
    const checkbox = wrapper.querySelector<HTMLInputElement>("#confirm-recovery-saved")!;
    const continueBtn = wrapper.querySelector<HTMLButtonElement>("#continue-after-recovery-btn")!;
    const modalError = wrapper.querySelector<HTMLParagraphElement>("#recovery-modal-error")!;

    copyBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(recoveryCode);
        }
        copyBtn.textContent = "✅ Código copiado!";
      } catch {
        copyBtn.textContent = "✅ Código copiado!";
      }
    });

    checkbox.addEventListener("change", () => {
      continueBtn.disabled = !checkbox.checked;
    });

    continueBtn.addEventListener("click", async () => {
      if (!checkbox.checked) return;
      continueBtn.disabled = true;
      modalError.style.display = "none";
      try {
        await login(passwordForLogin);
        await options.onAuthenticated();
      } catch (err) {
        modalError.textContent = String(err);
        modalError.style.display = "block";
        continueBtn.disabled = false;
      }
    });
  }

  function renderRecoveryScreen(): void {
    wrapper.innerHTML = `
      <div class="auth-header">
        <h1>lovelog</h1>
        <p class="auth-subtitle">Recuperação de Acesso e Reset de Fábrica 🔑</p>
      </div>

      <form id="recovery-form" class="auth-card" novalidate>
        <h2>Recuperar Acesso</h2>

        <label for="recovery-code-input">
          Código de Recuperação
          <input
            id="recovery-code-input"
            name="recoveryCode"
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autocomplete="off"
            required
          />
        </label>

        <label for="recovery-new-password">
          Nova Senha
          <input
            id="recovery-new-password"
            name="newPassword"
            type="password"
            placeholder="Mínimo de 4 caracteres"
            autocomplete="new-password"
            required
          />
        </label>

        <label for="recovery-confirm-password">
          Confirme a Nova Senha
          <input
            id="recovery-confirm-password"
            name="confirmNewPassword"
            type="password"
            placeholder="Repita a nova senha"
            autocomplete="new-password"
            required
          />
        </label>

        <p id="recovery-error" class="auth-error" role="alert" style="display:none;"></p>

        <div class="auth-actions">
          <button id="recovery-submit-btn" type="submit">
            Redefinir Senha e Entrar
          </button>
          <button id="back-to-login-btn" type="button" class="btn-secondary">
            Voltar ao login
          </button>
        </div>
      </form>

      <section id="factory-reset-section" class="factory-reset-card">
        <h2>Resetar Aplicativo</h2>
        <p>
          Não tem o código de recuperação? Você pode resetar o aplicativo para o estado original.
        </p>
        <button id="factory-reset-btn" type="button" class="btn-danger">
          Apagar tudo e começar do zero
        </button>

        <div id="factory-reset-confirm-box" class="factory-reset-confirm-box" style="display:none;">
          <p class="factory-reset-warning">
            ⚠️ <strong>Atenção:</strong> Esta ação apagará permanentemente sua senha, todos os encontros e todas as fotos salvas. Digite <strong>DELETAR</strong> abaixo para confirmar:
          </p>
          <input
            id="factory-reset-confirm-input"
            type="text"
            placeholder="Digite DELETAR"
            autocomplete="off"
          />
          <p id="factory-reset-error" class="auth-error" role="alert" style="display:none;"></p>
          <div class="auth-actions">
            <button id="factory-reset-confirm-btn" type="button" class="btn-danger">
              Confirmar exclusão total
            </button>
            <button id="factory-reset-cancel-btn" type="button" class="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </section>
    `;

    const recoveryForm = wrapper.querySelector<HTMLFormElement>("#recovery-form")!;
    const codeInput = wrapper.querySelector<HTMLInputElement>("#recovery-code-input")!;
    const newPassInput = wrapper.querySelector<HTMLInputElement>("#recovery-new-password")!;
    const confirmPassInput = wrapper.querySelector<HTMLInputElement>(
      "#recovery-confirm-password",
    )!;
    const recoveryError = wrapper.querySelector<HTMLParagraphElement>("#recovery-error")!;
    const recoverySubmitBtn = wrapper.querySelector<HTMLButtonElement>("#recovery-submit-btn")!;
    const backBtn = wrapper.querySelector<HTMLButtonElement>("#back-to-login-btn")!;

    const factoryResetBtn = wrapper.querySelector<HTMLButtonElement>("#factory-reset-btn")!;
    const confirmBox = wrapper.querySelector<HTMLDivElement>("#factory-reset-confirm-box")!;
    const confirmInput = wrapper.querySelector<HTMLInputElement>(
      "#factory-reset-confirm-input",
    )!;
    const confirmError = wrapper.querySelector<HTMLParagraphElement>("#factory-reset-error")!;
    const confirmSubmitBtn = wrapper.querySelector<HTMLButtonElement>(
      "#factory-reset-confirm-btn",
    )!;
    const confirmCancelBtn = wrapper.querySelector<HTMLButtonElement>(
      "#factory-reset-cancel-btn",
    )!;

    function showRecoveryError(msg: string): void {
      recoveryError.textContent = msg;
      recoveryError.style.display = "block";
    }

    backBtn.addEventListener("click", () => {
      renderMode("login");
    });

    recoveryForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      recoveryError.style.display = "none";

      const validation = validateRecoveryInput(
        codeInput.value,
        newPassInput.value,
        confirmPassInput.value,
      );

      if (!validation.valid) {
        showRecoveryError(validation.error);
        return;
      }

      recoverySubmitBtn.disabled = true;
      try {
        await resetPasswordWithRecoveryCode(
          validation.recoveryCode,
          validation.newPassword,
        );
        await login(validation.newPassword);
        await options.onAuthenticated();
      } catch (err) {
        showRecoveryError(String(err));
      } finally {
        recoverySubmitBtn.disabled = false;
      }
    });

    factoryResetBtn.addEventListener("click", () => {
      confirmBox.style.display = "grid";
      confirmError.style.display = "none";
      confirmInput.value = "";
      confirmInput.focus();
    });

    confirmCancelBtn.addEventListener("click", () => {
      confirmBox.style.display = "none";
      confirmError.style.display = "none";
      confirmInput.value = "";
    });

    confirmSubmitBtn.addEventListener("click", async () => {
      confirmError.style.display = "none";
      if (confirmInput.value.trim() !== "DELETAR") {
        confirmError.textContent =
          'Digite exatamente "DELETAR" (em maiúsculas) para confirmar o reset.';
        confirmError.style.display = "block";
        return;
      }

      confirmSubmitBtn.disabled = true;
      try {
        await factoryResetUnauthenticated();
        renderMode("setup");
      } catch (err) {
        confirmError.textContent = String(err);
        confirmError.style.display = "block";
      } finally {
        confirmSubmitBtn.disabled = false;
      }
    });
  }

  renderMode(options.mode);
  return wrapper;
}
