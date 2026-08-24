import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="container py-24">
      <div className="rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground">
        <h2 className="mb-4 text-4xl font-extrabold">Готов начать?</h2>
        <p className="mx-auto mb-8 max-w-lg opacity-90">
          Финальный оффер + одна кнопка. Убери трение — дай нажать.
        </p>
        <Button size="lg" variant="secondary">
          Оставить заявку
        </Button>
      </div>
    </section>
  );
}
