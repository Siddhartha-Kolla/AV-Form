import { RegistrationForm } from "@/components/registration-form";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[44rem] px-5 pb-24 sm:px-8">
      <p className="py-6 text-[15px] font-semibold tracking-tight sm:py-8">Technikteam</p>
      <main className="pt-6 sm:pt-10">
        <RegistrationForm />
      </main>
    </div>
  );
}
