import { parseBrDate } from "./date";

export interface FormValues {
  dateBr: string;
  location: string;
  description?: string;
  photo?: { size: number; type: string } | null;
}

export interface ValidationSuccess {
  valid: true;
  data: {
    dateIso: string;
    location: string;
    description: string;
  };
}

export interface ValidationFailure {
  valid: false;
  errors: {
    date?: string;
    location?: string;
    description?: string;
    photo?: string;
  };
}

export type FormValidationResult = ValidationSuccess | ValidationFailure;

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (RN04)
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validação do formulário de encontros (UT-23 / RN01-RN04).
 */
export function validateForm(values: FormValues): FormValidationResult {
  const errors: ValidationFailure["errors"] = {};

  // RN01: data obrigatória, formato DD/MM/AAAA e calendário válido
  const rawDate = values.dateBr.trim();
  let parsedIso = "";
  if (!rawDate) {
    errors.date = "Data é obrigatória.";
  } else {
    const parsed = parseBrDate(rawDate);
    if (!parsed.ok) {
      errors.date =
        parsed.error === "format"
          ? "Formato inválido. Use DD/MM/AAAA."
          : "Essa data não existe no calendário.";
    } else {
      parsedIso = parsed.iso;
    }
  }

  // RN02: local obrigatório, 1-120 chars após trim
  const trimmedLoc = values.location.trim();
  if (!trimmedLoc) {
    errors.location = "Local é obrigatório.";
  } else if (trimmedLoc.length > 120) {
    errors.location = "Local deve ter no máximo 120 caracteres.";
  }

  // RN03: descrição opcional, até 5000 chars
  const desc = values.description ?? "";
  if (desc.length > 5000) {
    errors.description = "Descrição deve ter no máximo 5000 caracteres.";
  }

  // RN04: foto até 10 MB e tipo suportado
  if (values.photo) {
    if (values.photo.size > MAX_PHOTO_BYTES) {
      errors.photo = "Foto muito grande. Tamanho máximo: 10 MB.";
    } else if (
      values.photo.type &&
      !ALLOWED_IMAGE_TYPES.includes(values.photo.type.toLowerCase())
    ) {
      errors.photo = "Formato de foto inválido. Use JPEG, PNG ou WebP.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      dateIso: parsedIso,
      location: trimmedLoc,
      description: desc,
    },
  };
}

