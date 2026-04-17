import React, { useState } from 'react'
import { Activity } from 'lucide-react'
import { motion } from 'motion/react'

export function App() {
  const [pingResult, setPingResult] = useState<string>('')

  const handlePing = async () => {
    try {
      const result = await window.api.ping()
      setPingResult(result)
    } catch (e) {
      setPingResult('Error pinging main process')
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#FDFDFD] text-[#1C1C1C] font-sans selection:bg-[#E5E5E5]">
      <div className="flex flex-col items-center gap-6 p-8 bg-white border border-[#E5E5E5] w-[400px]">
        <motion.div
          animate={{ rotate: 180 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="text-[#1C1C1C]"
        >
          <Activity strokeWidth={1} size={48} />
        </motion.div>
        
        <div className="text-center space-y-2">
          <h1 className="text-xl font-medium tracking-tight">Tree Knowledge</h1>
          <p className="text-[#666666] text-sm tracking-wide">Knowledge Operating System</p>
        </div>
        
        <div className="flex flex-col gap-3 w-full mt-8">
          <button
            onClick={handlePing}
            className="w-full px-4 py-2 bg-[#1C1C1C] hover:bg-[#333333] text-white transition-colors text-sm font-medium cursor-pointer rounded-sm"
          >
            Verify IPC Bridge
          </button>
          
          <div className="h-10 flex items-center justify-center border border-[#E5E5E5] bg-[#F9F9F9] text-xs font-mono text-[#666666]">
            {pingResult || 'Awaiting connection...'}
          </div>
        </div>
      </div>
    </div>
  )
}
