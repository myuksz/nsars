export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 20_000_000;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export type MediaRightsStatus = "NOT_GRANTED" | "APPROVED" | "REVOKED";
export type MediaLifecycle = "DRAFT" | "READY" | "ARCHIVED";
export type MediaRecoveryStatus =
  | "PENDING_INDEPENDENT_COPY"
  | "VERIFIED_INDEPENDENT_COPY";
export type MediaFitMode = "cover" | "contain";

export type MediaItem = {
  id: string;
  mediaType: "image";
  name: string;
  mimeType: ImageMimeType;
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  aspectRatio: string;
  alt: string;
  caption: string;
  fitMode: MediaFitMode;
  focalX: number;
  focalY: number;
  rightsStatus: MediaRightsStatus;
  rightsScope: string;
  lifecycle: MediaLifecycle;
  recoveryStatus: MediaRecoveryStatus;
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type MediaMetadataUpdate = Pick<
  MediaItem,
  | "alt"
  | "caption"
  | "fitMode"
  | "focalX"
  | "focalY"
  | "rightsStatus"
  | "rightsScope"
  | "lifecycle"
  | "recoveryStatus"
>;

export class MediaValidationError extends Error {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "MediaValidationError";
    this.details = details;
  }
}

export function validateMediaMetadataUpdate(
  input: unknown,
): MediaMetadataUpdate {
  if (!isRecord(input)) {
    throw new MediaValidationError("Метаданные файла должны быть объектом.");
  }
  const allowed = new Set([
    "alt",
    "caption",
    "fitMode",
    "focalX",
    "focalY",
    "rightsStatus",
    "rightsScope",
    "lifecycle",
    "recoveryStatus",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new MediaValidationError("Переданы неизвестные поля.", unknown);
  }
  const alt = textField(input.alt, "Альтернативный текст", 1, 220);
  const caption = textField(input.caption, "Подпись", 0, 300);
  const rightsScope = textField(input.rightsScope, "Основание и объём прав", 0, 500);
  if (!new Set(["cover", "contain"]).has(String(input.fitMode))) {
    throw new MediaValidationError("Недопустимый режим размещения изображения.");
  }
  if (
    !new Set(["NOT_GRANTED", "APPROVED", "REVOKED"]).has(
      String(input.rightsStatus),
    )
  ) {
    throw new MediaValidationError("Недопустимый статус прав.");
  }
  if (input.rightsStatus === "APPROVED" && !rightsScope.trim()) {
    throw new MediaValidationError(
      "Для подтверждённых прав укажите основание и разрешённый объём использования.",
    );
  }
  if (!new Set(["DRAFT", "READY", "ARCHIVED"]).has(String(input.lifecycle))) {
    throw new MediaValidationError("Недопустимый статус готовности файла.");
  }
  if (
    !new Set([
      "PENDING_INDEPENDENT_COPY",
      "VERIFIED_INDEPENDENT_COPY",
    ]).has(String(input.recoveryStatus))
  ) {
    throw new MediaValidationError("Недопустимый статус независимой копии.");
  }
  if (
    input.lifecycle === "READY" &&
    (input.rightsStatus !== "APPROVED" ||
      input.recoveryStatus !== "VERIFIED_INDEPENDENT_COPY")
  ) {
    throw new MediaValidationError(
      "Статус READY доступен только после подтверждения прав и независимой копии.",
    );
  }
  if (input.rightsStatus === "REVOKED" && input.lifecycle !== "ARCHIVED") {
    throw new MediaValidationError(
      "При отзыве прав файл должен быть переведён в архив.",
    );
  }
  const focalX = coordinate(input.focalX, "Фокус X");
  const focalY = coordinate(input.focalY, "Фокус Y");
  return {
    alt,
    caption,
    fitMode: input.fitMode as MediaFitMode,
    focalX,
    focalY,
    rightsStatus: input.rightsStatus as MediaRightsStatus,
    rightsScope,
    lifecycle: input.lifecycle as MediaLifecycle,
    recoveryStatus: input.recoveryStatus as MediaRecoveryStatus,
  };
}

export async function inspectImageFile(file: File) {
  if (!IMAGE_MIME_TYPES.includes(file.type as ImageMimeType)) {
    throw new MediaValidationError(
      "Поддерживаются только JPG, PNG и WebP.",
    );
  }
  if (file.size < 32 || file.size > MAX_IMAGE_BYTES) {
    throw new MediaValidationError(
      `Размер изображения должен быть от 32 байт до ${MAX_IMAGE_BYTES / 1_000_000} МБ.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected || detected.mimeType !== file.type) {
    throw new MediaValidationError(
      "Содержимое файла не соответствует заявленному формату.",
    );
  }
  if (detected.width < 32 || detected.height < 32) {
    throw new MediaValidationError("Размер изображения слишком мал.");
  }
  const sha256 = await digestHex(bytes);
  return {
    bytes,
    mimeType: detected.mimeType,
    width: detected.width,
    height: detected.height,
    aspectRatio: `${detected.width}:${detected.height}`,
    sha256,
  };
}

export function safeMediaFilename(value: string) {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "");
  const leaf = normalized.split(/[\\/]/).pop()?.trim() ?? "image";
  return leaf.slice(0, 180) || "image";
}

function detectImage(bytes: Uint8Array):
  | { mimeType: ImageMimeType; width: number; height: number }
  | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mimeType: "image/png",
      width: readU32be(bytes, 16),
      height: readU32be(bytes, 20),
    };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const sof = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const length = readU16be(bytes, offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (sof.has(marker) && length >= 7) {
        return {
          mimeType: "image/jpeg",
          height: readU16be(bytes, offset + 3),
          width: readU16be(bytes, offset + 5),
        };
      }
      offset += length;
    }
    return null;
  }
  if (
    bytes.length >= 30 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X") {
      return {
        mimeType: "image/webp",
        width: 1 + readU24le(bytes, 24),
        height: 1 + readU24le(bytes, 27),
      };
    }
    if (chunk === "VP8 " && bytes.length >= 30) {
      return {
        mimeType: "image/webp",
        width: readU16le(bytes, 26) & 0x3fff,
        height: readU16le(bytes, 28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f && bytes.length >= 25) {
      const bits =
        bytes[21] |
        (bytes[22] << 8) |
        (bytes[23] << 16) |
        (bytes[24] << 24);
      return {
        mimeType: "image/webp",
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }
  }
  return null;
}

function textField(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string" || value.trim().length < minimum || value.length > maximum) {
    throw new MediaValidationError(
      `${label}: требуется строка длиной ${minimum}–${maximum}.`,
    );
  }
  return value.trim();
}

function coordinate(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new MediaValidationError(`${label}: значение должно быть от 0 до 1.`);
  }
  return Math.round(value * 10_000) / 10_000;
}

async function digestHex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function readU16be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU16le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
