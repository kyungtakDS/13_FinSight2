import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function Home() {
  return (
    <main>
      <p>FinSight<span aria-hidden="true">.</span></p>
      <h1>카드 명세서에서 사업 경비 후보를 정리합니다.</h1>
      <GoogleSignInButton />
      <ThemeToggle />
    </main>
  );
}
