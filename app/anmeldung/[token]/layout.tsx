import type { Metadata } from "next";

// Das Token steht in der Adresse. Der Link soll nicht in Suchmaschinen landen und nicht als Referrer weitergegeben werden.
export const metadata: Metadata = {
  title: "Ihre Anmeldung | Technikteam",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PrivaterLinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pb-20 sm:px-6">
      <p className="px-2 py-6 text-[15px] font-semibold tracking-tight sm:py-8">Technikteam</p>
      <main className="rounded-lg border border-border bg-surface px-5 py-9 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10 sm:py-12">
        {children}
      </main>
    </div>
  );
}
