export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "BRIEF_DISABLED_PRE_RELEASE",
      error:
        "Форма отключена до проверки получателя, правовых текстов и маршрута доставки. Данные не принимались и не сохранялись.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "86400",
      },
    },
  );
}
