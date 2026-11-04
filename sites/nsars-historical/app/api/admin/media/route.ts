import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import {
  listMediaItems,
  updateMediaItem,
  uploadImage,
} from "@/lib/media-store";
import { RepositoryError } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeAdmin(request.headers);
    return Response.json(
      { ok: true, media: await listMediaItems() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > 21_000_000) {
      throw new RepositoryError(
        "INVALID_DOCUMENT",
        "Загрузка превышает допустимые 20 МБ.",
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new RepositoryError(
        "INVALID_DOCUMENT",
        "Изображение не выбрано.",
      );
    }
    const item = await uploadImage(
      file,
      String(form.get("alt") ?? ""),
      String(form.get("caption") ?? ""),
      actor.auditId,
    );
    return Response.json(
      {
        ok: true,
        item,
        media: await listMediaItems(),
        notice:
          "Файл сохранён в черновой медиатеке. Публикация закрыта до проверки прав и независимой копии.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string") {
      throw new TypeError("Body must include media id");
    }
    const item = await updateMediaItem(body.id, body.metadata, actor.auditId);
    return Response.json(
      {
        ok: true,
        item,
        media: await listMediaItems(),
        notice: "Метаданные сохранены.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

