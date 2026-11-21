import type { Metadata } from "next";
import Link from "next/link";
import { LinkForm } from "./link-form";

export const metadata: Metadata = {
  title: "Link verloren | Technikteam",
  robots: { index: false, follow: false },
};

export default function LinkVerlorenSeite() {
  return (
    <div className="mx-auto w-full max-w-[34rem] px-3 pb-20 sm:px-6">
      <div className="px-2 py-6 sm:py-8">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Technikteam
        </Link>
      </div>
      <main className="rounded-lg border border-border bg-surface px-5 py-9 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10 sm:py-12">
        <LinkForm />
      </main>
    </div>
  );
}
