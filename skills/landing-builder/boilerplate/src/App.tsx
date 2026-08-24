// The landing = a COMPOSITION of sections. The agent adds/reorders sections and
// swaps in ready blocks pulled from registries (npx shadcn add <url>).
import { Hero } from "@/sections/Hero";
import { Features } from "@/sections/Features";
import { CTA } from "@/sections/CTA";

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <Features />
      <CTA />
      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} — сделано в AgentFlow
      </footer>
    </main>
  );
}
