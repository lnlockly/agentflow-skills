// Hero — the thesis of the page. Swap this for a threeui 3D/shader hero:
//   npx shadcn add "https://threeui.com/r/<component>.json"  → import it here.
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="container flex flex-col items-center gap-6 py-28 text-center">
      <span className="rounded-full border border-border px-4 py-1 text-xs uppercase tracking-widest text-muted-foreground">
        новый продукт
      </span>
      <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
        Твой оффер — <span className="text-primary">одной сильной строкой</span>
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Подзаголовок: что это и почему стоит нажать кнопку прямо сейчас.
      </p>
      <div className="flex gap-3">
        <Button size="lg">Начать бесплатно</Button>
        <Button size="lg" variant="outline">
          Смотреть демо
        </Button>
      </div>
    </section>
  );
}
