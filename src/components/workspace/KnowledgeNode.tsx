import { Handle, Position } from "@xyflow/react";

export function KnowledgeNode({ data, selected }: { data: any, selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 transition-all w-[180px] bg-white shadow-sm ${
      selected ? 'border-blue-500 shadow-blue-100 ring-4 ring-blue-50' : 'border-gray-200'
    }`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-300 border-none" />
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
          {data.status}
        </span>
        <h3 className="text-sm font-bold text-gray-900 truncate">{data.label}</h3>
        <p className="text-[10px] text-gray-500 line-clamp-2 leading-snug">
          {data.summary}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-300 border-none" />
    </div>
  );
}
