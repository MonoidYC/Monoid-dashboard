import Link from "next/link";
import { GitBranch, Network, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#08080a]">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.08] flex items-center justify-center">
            <Network className="w-8 h-8 text-white/90" />
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            Monoid
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-xl text-gray-400 mb-14 max-w-xl mx-auto font-light leading-relaxed tracking-tight">
          Visualize your codebase as an interactive dependency graph.
          Understand impact and explore your architecture.
        </p>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-14">
          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 mx-auto">
              <GitBranch className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">AST-Derived Nodes</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              Functions, classes, endpoints, and more — parsed directly from your code.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 mx-auto">
              <Network className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">Dependency Graph</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              See how your code connects — imports, calls, routes, and more.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 mx-auto">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">Blast Radius</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              Understand the impact of changes before you make them.
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/graph/demo"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-black font-medium text-[15px] hover:bg-white/90 transition-all tracking-tight"
        >
          <Network className="w-[18px] h-[18px]" />
          View Demo Graph
        </Link>

        <p className="mt-5 text-sm text-gray-600 font-light">
          No login required
        </p>
      </div>
    </main>
  );
}
