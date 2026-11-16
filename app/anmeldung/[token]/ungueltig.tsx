export function UngueltigerLink() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dieser Link ist nicht gültig</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
        Vielleicht fehlt ein Stück des Links, oder er wurde durch einen neueren ersetzt. Öffnen Sie bitte den Link aus der
        letzten E-Mail des Technikteams. Hilft das nicht, melden Sie sich bitte beim Technikteam.
      </p>
    </div>
  );
}
