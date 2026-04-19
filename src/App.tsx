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
    <div className="h-screen overflow-hidden bg-white">
      <AnimatePresence mode="wait">
        {view.type === "launchpad" && (
          <motion.div
            key="launchpad"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4 }}
            className="h-full"
          >
            <Launchpad onEnterWorkspace={enterWorkspace} onOpenSettings={openSettings} />
          </motion.div>
        )}
        
        {view.type === "workspace" && (
          <motion.div
            key="workspace"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: "spring", damping: 20 }}
            className="h-full"
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <ProviderSettings onBack={backToLaunchpad} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
