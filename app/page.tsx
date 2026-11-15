import { RegistrationForm } from "@/components/registration-form";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pb-20 sm:px-6">
      <p className="px-2 py-6 text-[15px] font-semibold tracking-tight sm:py-8">Technikteam</p>
      <main className="rounded-lg border border-border bg-surface px-5 py-9 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-12 sm:py-14">
        <RegistrationForm />
      </main>
    </div>
  );
}
