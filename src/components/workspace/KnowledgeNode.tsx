import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";

export function KnowledgeNode({ data, selected }: { data: any, selected?: boolean }) {
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`px-6 py-5 rounded-[2rem] border-2 transition-all w-[240px] bg-white relative ${
        selected 
          ? 'border-black shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-8 ring-black/5' 
          : 'border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:border-gray-200'
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 !bg-gray-100 border-2 border-white shadow-sm" 
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">
            {data.status}
          </span>
          {selected && (
            <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
          )}
        </div>
        
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight leading-tight line-clamp-2">
          {data.label}
        </h3>
        
        <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed">
          {data.summary}
        </p>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 !bg-gray-100 border-2 border-white shadow-sm" 
      />
    </motion.div>
  );
}
