import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl flex-col items-center justify-center">
        <div className="flex w-full justify-center">
          <div className="w-full max-w-[720px]">
          <Image
            src="/zonara-accueil.png"
            alt="Zonara"
            width={1536}
            height={1152}
            className="h-auto w-full object-contain"
            priority
          />
          </div>
        </div>

        <Link
          href="/login"
          className="mt-10 inline-flex min-w-[220px] items-center justify-center rounded-2xl border border-black bg-white px-8 py-4 text-base font-semibold text-black no-underline transition hover:bg-black hover:text-white"
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}
