import { revalidatePath } from "next/cache";
import { anfrageKontext } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { antwort, liesFormular } from "@/lib/server/formular-anfrage";
import { bearbeiteFuerLehrkraft } from "@/lib/server/lehrkraft";

/** Änderungen einer Lehrkraft über ihren privaten Link. Das Token in der Adresse ist der Zugang. */
export async function POST(anfrage: Request, { params }: { params: Promise<{ token: string }> }) {
  const gelesen = await liesFormular(anfrage);
  if (!gelesen.ok) return gelesen.antwort;

  const { token } = await params;
  try {
    const ergebnis = bearbeiteFuerLehrkraft(
      token,
      {
        values: gelesen.values,
        revision: Number(gelesen.formular.get("revision")),
        notiz: "",
        entferneDateiIds: gelesen.entferne,
        neueDateien: gelesen.dateien,
      },
      await anfrageKontext(),
    );
    if (ergebnis.ok && ergebnis.geaendert.length > 0) revalidatePath("/team");
    // Titel und Anzahlen gehen die Lehrkraft nichts an. Die Antwort enthält nur, ob es geklappt hat.
    return antwort(ergebnis.ok ? { ok: true } : ergebnis, ergebnis.ok ? 200 : 422);
  } catch (fehler) {
    if (fehler instanceof FachFehler) return antwort({ ok: false, meldung: fehler.message }, 403);
    console.error(fehler);
    return antwort({ ok: false, meldung: "Das Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal." }, 500);
  }
}
