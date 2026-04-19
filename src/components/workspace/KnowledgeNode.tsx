import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";

export function KnowledgeNode({ data, selected }: { data: any, selected?: boolean }) {
  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`px-8 py-6 rounded-[2.5rem] border-2 transition-all w-[280px] relative backdrop-blur-2xl ${
        selected 
          ? 'bg-white/20 border-white/40 shadow-[0_0_50px_rgba(255,255,255,0.1)]' 
          : 'bg-neutral-900/40 border-white/5 hover:border-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-2 h-2 !bg-white/20 border-none" 
      />
      
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${selected ? 'text-blue-400' : 'text-gray-500'}`}>
            {data.status}
          </span>
          {selected && (
            <motion.div 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" 
            />
          )}
        </div>
        
        <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
          {data.label}
        </h3>
        
        <p className="text-[11px] text-gray-400 font-medium line-clamp-2 leading-relaxed opacity-70">
          {data.summary}
        </p>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-2 h-2 !bg-white/20 border-none" 
      />
    </motion.div>
  );
}
