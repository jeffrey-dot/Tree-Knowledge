import { useState } from "react";
import Launchpad from "./views/launchpad/Launchpad";
import WorkspaceView from "./views/workspace/Workspace";
import ProviderSettings from "./views/provider-settings/ProviderSettings";
import "./App.css";

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
    <div className="h-screen overflow-hidden">
      {view.type === "launchpad" && (
        <Launchpad onEnterWorkspace={enterWorkspace} onOpenSettings={openSettings} />
      )}
      
      {view.type === "workspace" && (
        <WorkspaceView 
          workspaceId={view.workspaceId} 
          onBack={backToLaunchpad} 
        />
      )}

      {view.type === "settings" && (
        <ProviderSettings onBack={backToLaunchpad} />
      )}
    </div>
  );
}

export default App;
