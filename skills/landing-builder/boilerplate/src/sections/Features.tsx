import { Zap, ShieldCheck, Sparkles } from "lucide-react";

const items = [
  { icon: Zap, title: "Быстро", text: "Готовый результат за минуты, а не недели." },
  { icon: ShieldCheck, title: "Надёжно", text: "Проверенные блоки, аккуратный код." },
  { icon: Sparkles, title: "Красиво", text: "Современный вид из коробки, под твой бренд." },
];

export function Features() {
  return (
    <section className="container py-20">
      <h2 className="mb-12 text-center text-3xl font-bold">Почему это работает</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-8">
            <Icon className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-2 text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
