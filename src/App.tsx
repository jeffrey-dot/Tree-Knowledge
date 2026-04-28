import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ContextPreview } from "./components/ContextPreview";
import {
  LlmSettingsDialog,
  NewKnowledgeBaseDialog,
  NodeDetailDialog,
} from "./components/KnowledgeDialogs";
import { LibraryOverview } from "./components/LibraryOverview";
import { TreeCanvas } from "./components/TreeCanvas";
import type { KnowledgeBaseDraft } from "./domain/knowledgeBase";
import { useKnowledgeWorkspace } from "./hooks/useKnowledgeWorkspace";
import {
  loadLlmSettings,
  saveLlmSettings,
  type LlmSettings,
} from "./llm";
import { cx } from "./utils";

function App() {
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() =>
    loadLlmSettings(),
  );
  const [showKnowledgeBaseDialog, setShowKnowledgeBaseDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const workspace = useKnowledgeWorkspace(llmSettings);

  function handleSaveLlmSettings(settings: LlmSettings) {
    saveLlmSettings(settings);
    setLlmSettings(settings);
    setShowSettings(false);
  }

  function handleCreateKnowledgeBase(draft: KnowledgeBaseDraft) {
    workspace.handleCreateKnowledgeBase(draft);
    setShowKnowledgeBaseDialog(false);
  }

  return (
    <div className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:overflow-visible">
      <AppHeader
        activeRootTitle={workspace.activeRootNode?.title}
        appView={workspace.appView}
        isWorkspaceView={workspace.isWorkspaceView}
        librarySearch={workspace.librarySearch}
        llmSettings={llmSettings}
        onBackToLibrary={workspace.handleBackToLibrary}
        onOpenNewKnowledgeBase={() => setShowKnowledgeBaseDialog(true)}
        onOpenSettings={() => setShowSettings(true)}
        onSearchChange={workspace.setLibrarySearch}
      />

      <main
        className={cx(
          "relative block min-h-0",
          workspace.appView === "library"
            ? "overflow-auto"
            : "overflow-hidden max-[760px]:min-h-[1200px]",
        )}
      >
        {workspace.isWorkspaceView ? (
          <section
            className="relative h-full min-w-0 overflow-hidden max-[760px]:overflow-visible"
            aria-label="知识树画布"
          >
            <CanvasToolbar
              parentChain={workspace.parentChain}
              onToggleContext={workspace.handleToggleContext}
            />
            <TreeCanvas
              nodes={workspace.treeNodes}
              activeNodeId={workspace.activeNode?.id ?? null}
              detailMap={workspace.nodeDetailMap}
              generatingNodeIds={workspace.generatingNodeIds}
              parentChainIds={workspace.parentChainIds}
              onCreateSuggestedNode={workspace.handleCreateSuggestedNode}
              onSelectNode={workspace.handleSelectNode}
            />
            {workspace.showContext && workspace.activeNode ? (
              <ContextPreview
                activeNode={workspace.activeNode}
                detailMap={workspace.nodeDetailMap}
                nodes={workspace.treeNodes}
                parentChain={workspace.parentChain}
              />
            ) : null}
            {workspace.detailNode ? (
              <NodeDetailDialog
                detailMap={workspace.nodeDetailMap}
                isGenerating={workspace.generatingNodeIds.has(
                  workspace.detailNode.id,
                )}
                node={workspace.detailNode}
                onClose={() => workspace.setDetailNodeId(null)}
                onRegenerate={workspace.handleRegenerateNodeContent}
              />
            ) : null}
          </section>
        ) : (
          <LibraryOverview
            knowledgeBases={workspace.knowledgeBases}
            query={workspace.librarySearch}
            onOpenKnowledgeBase={workspace.handleOpenKnowledgeBase}
          />
        )}

        {showSettings ? (
          <LlmSettingsDialog
            initialSettings={llmSettings}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveLlmSettings}
          />
        ) : null}
        {showKnowledgeBaseDialog ? (
          <NewKnowledgeBaseDialog
            onClose={() => setShowKnowledgeBaseDialog(false)}
            onCreate={handleCreateKnowledgeBase}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
