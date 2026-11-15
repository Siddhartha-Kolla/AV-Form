import { RegistrationForm } from "@/components/registration-form";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pb-20 sm:px-6 xl:max-w-[72rem]">
      <p className="px-2 py-6 text-[15px] font-semibold tracking-tight sm:py-8">Technikteam</p>
      <RegistrationForm />
    </div>
  );
}
