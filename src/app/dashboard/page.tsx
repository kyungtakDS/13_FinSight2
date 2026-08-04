import { Dropzone } from "@/components/upload/Dropzone";
import { UploadList, type UploadListItem } from "@/components/upload/UploadList";
import { createClient, getUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await getUser();
  let uploads: UploadListItem[] = [];

  if (user) {
    const client = await createClient();
    const { data } = await client
      .from("uploads")
      .select("id, filename, status, error_code, period_start, period_end, row_count, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    uploads = (data ?? []) as UploadListItem[];
  }

  return (
    <>
      <Dropzone />
      <UploadList uploads={uploads} />
    </>
  );
}
