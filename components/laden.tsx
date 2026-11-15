/**
 * Platzhalter, der sofort erscheint, wenn man im Teambereich die Seite wechselt und die neue Seite
 * noch lädt. Jede Seite umschließt ihren Inhalt mit einer eigenen Suspense-Grenze und diesem Platzhalter.
 * Nur eine neue Grenze zeigt den Platzhalter sofort, eine schon sichtbare hält die alte Seite fest.
 */
export function Laden() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Wird geladen</span>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="h-8 w-52 rounded-md bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-muted" />
        <div className="mt-10 divide-y divide-border border-y border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-6 py-5">
              <div className="h-10 w-14 shrink-0 rounded-md bg-muted" />
              <div className="flex-1 space-y-2.5">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-4 w-2/5 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
