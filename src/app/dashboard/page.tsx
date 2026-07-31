import { SignOutButton } from "@/components/auth/SignOutButton";
import { getUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <main>
      <h1>FinSight</h1>
      <p>{user?.email}</p>
      <SignOutButton />
    </main>
  );
}
