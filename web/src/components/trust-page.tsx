import { HeaderTitle } from "@/components/app-shell";

export function TrustPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <article className="space-y-8">
        <HeaderTitle className="text-3xl font-semibold tracking-tight">{title}</HeaderTitle>
        {children}
      </article>
    </main>
  );
}

export function TrustSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground space-y-2 leading-7">{children}</div>
    </section>
  );
}
