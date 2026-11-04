import { redirect } from "next/navigation";
import { isValidPageId } from "@/lib/page-contract";

export const dynamic = "force-dynamic";

export default async function AdminIndex({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = resolvedSearchParams.page;
  const requestedPage = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const pageId = requestedPage && isValidPageId(requestedPage)
    ? requestedPage
    : "page_home";
  redirect(`/admin/pages/${encodeURIComponent(pageId)}/`);
}
