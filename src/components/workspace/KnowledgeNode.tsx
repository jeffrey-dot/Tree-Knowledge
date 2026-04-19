import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";

export interface KnowledgeNodeData extends Record<string, unknown> {
  label: string;
  summary: string | null;
  status: string;
  relationLabel: string | null;
  relationTone: string;
}

export type KnowledgeGraphNode = Node<KnowledgeNodeData, "knowledge">;

export function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeGraphNode>) {
  const statusTone = selected ? "text-amber-200" : "text-stone-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-[248px] pt-9"
    >
      <div className="absolute left-1/2 top-0 h-9 w-px -translate-x-1/2 bg-gradient-to-b from-white/55 via-white/20 to-transparent" />
      <div
        className={`absolute left-1/2 top-7 h-2.5 w-2.5 -translate-x-1/2 rounded-full border ${
          selected
            ? "border-amber-200/80 bg-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
            : "border-white/25 bg-stone-100/80 shadow-[0_0_14px_rgba(255,255,255,0.18)]"
        }`}
      />

      <div
        className={`relative overflow-hidden rounded-[1.7rem] border px-5 py-4 shadow-[0_16px_42px_rgba(0,0,0,0.35)] transition-all duration-300 ${
          selected
            ? "border-amber-200/45 bg-[linear-gradient(180deg,rgba(255,250,240,0.18),rgba(18,18,16,0.92))] ring-1 ring-amber-100/15"
            : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(12,12,12,0.9))] hover:border-white/18 hover:-translate-y-1"
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_48%)] opacity-70" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className={`text-[8px] font-black uppercase tracking-[0.28em] ${statusTone}`}>
              {data.status}
            </span>
            {data.relationLabel ? (
              <span
                className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.18em] ${data.relationTone}`}
              >
                {data.relationLabel}
              </span>
            ) : (
              <span className="text-[8px] font-medium uppercase tracking-[0.18em] text-white/25">
                Preview
              </span>
            )}
          </div>

          <h3 className="text-[13px] font-black uppercase tracking-[0.02em] leading-tight text-white line-clamp-3">
            {data.label}
          </h3>

          <p className="min-h-[2.9rem] text-[10px] leading-relaxed text-stone-300/70 line-clamp-3">
            {data.summary ?? "Open this note to inspect the full branch."}
          </p>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-none !bg-transparent !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-transparent !opacity-0"
      />
    </motion.div>
  );
}
