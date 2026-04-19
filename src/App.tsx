import { useState } from "react";
import Launchpad from "./views/launchpad/Launchpad";
import WorkspaceView from "./views/workspace/Workspace";
import ProviderSettings from "./views/provider-settings/ProviderSettings";
import "./App.css";
import { motion, AnimatePresence } from "framer-motion";

type View = {
  type: "launchpad";
} | {
  type: "workspace";
  workspaceId: string;
} | {
  type: "settings";
};

function App() {
  const [view, setView] = useState<View>({ type: "launchpad" });

  const enterWorkspace = (workspaceId: string) => {
    setView({ type: "workspace", workspaceId });
  };

  const backToLaunchpad = () => {
    setView({ type: "launchpad" });
  };

  const openSettings = () => {
    setView({ type: "settings" });
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-black relative text-white">
      {/* PERSISTENT GLOBAL NEBULA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] bg-blue-900/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[100px]" 
        />
      </div>

      {/* CONTENT LAYER */}
      <div className="relative z-10 h-full w-full">
        <AnimatePresence mode="wait">
          {view.type === "launchpad" && (
            <motion.div
              key="launchpad"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full"
            >
              <Launchpad onEnterWorkspace={enterWorkspace} onOpenSettings={openSettings} />
            </motion.div>
          )}
          
          {view.type === "workspace" && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full"
            >
              <WorkspaceView 
                workspaceId={view.workspaceId} 
                onBack={backToLaunchpad} 
              />
            </motion.div>
          )}

          {view.type === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: "anticipate" }}
              className="h-full w-full"
            >
              <ProviderSettings onBack={backToLaunchpad} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
