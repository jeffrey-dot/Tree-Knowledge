import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  Compass,
  Edit3,
  Loader2,
  Maximize2,
  Save,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import KnowledgeGraph from "../../components/workspace/KnowledgeGraph";
import StructuredCandidatesStreamPreview from "../../components/llm/StructuredCandidatesStreamPreview";
import StructuredStreamPreview from "../../components/llm/StructuredStreamPreview";
import MarkdownPreview, { markdownToPlainText } from "../../components/markdown/MarkdownPreview";
import { isLlmStreamEvent } from "../../lib/llmStream";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  root_node_id: string | null;
}

interface TreeNode {
  id: string;
  workspace_id: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
}

interface NodeEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
}

interface NodeCandidate {
  id: string;
  title: string;
  summary: string;
  relation_type: string;
  mode: string;
  why_this_branch: string;
}

interface WorkspaceSnapshot {
  workspace: Workspace;
  current_node: TreeNode | null;
  ancestors: TreeNode[];
  children: TreeNode[];
  edges: NodeEdge[];
  recent_candidates: NodeCandidate[];
}

interface FullGraphData {
  nodes: TreeNode[];
  edges: NodeEdge[];
}

interface DeleteNodeResult {
  deleted_workspace: boolean;
  next_node_id: string | null;
}

export default function WorkspaceView({
  workspaceId,
  onBack,
}: {
  workspaceId: string;
  onBack: () => void;
}) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectionQuery, setSelectionQuery] = useState("");
  const [selectedExcerpt, setSelectedExcerpt] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isGlobalView, setIsGlobalView] = useState(false);
  const [fullGraph, setFullGraph] = useState<FullGraphData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [readMode, setReadMode] = useState<"summary" | "full">("summary");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const [streamLabel, setStreamLabel] = useState<string | null>(null);
  const [streamOperation, setStreamOperation] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const selectableContentRef = useRef<HTMLDivElement | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const hydratedRootCandidatesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadSnapshot(currentNodeId);
  }, [currentNodeId, workspaceId]);

  useEffect(() => {
    if (isGlobalView) {
      void loadFullGraph();
    }
  }, [isGlobalView, workspaceId]);

  useEffect(() => {
    if (!snapshot?.current_node) {
      return;
    }

    setReadMode(snapshot.current_node.summary ? "summary" : "full");
  }, [snapshot?.current_node?.id, snapshot?.current_node?.summary]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<unknown>("llm-stream", (event) => {
        const payload = event.payload;
        if (!isLlmStreamEvent(payload) || payload.request_id !== streamRequestIdRef.current) {
          return;
        }

        setStreamOperation(payload.operation);

        if (payload.stage === "delta" && payload.content) {
          setStreamPreview((current) => current + payload.content);
          return;
        }

        if (payload.stage === "error" && payload.error) {
          setStreamError(payload.error);
        }
      });

      if (!isMounted && unlisten) {
        unlisten();
      }
    };

    void setup();

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    const currentNode = snapshot?.current_node;
    const rootNodeId = snapshot?.workspace.root_node_id;

    if (!currentNode || currentNode.id !== rootNodeId) {
      return;
    }

    if (snapshot.recent_candidates.length > 0 || isProposing) {
      return;
    }

    if (hydratedRootCandidatesRef.current.has(currentNode.id)) {
      return;
    }

    hydratedRootCandidatesRef.current.add(currentNode.id);
    setIsProposing(true);

    void (async () => {
      const requestId = startStreamPreview("Live branch prediction", "generate_candidates");
      try {
        await invoke("generate_candidates", {
          workspaceId,
          nodeId: currentNode.id,
          query: "Follow up on the initial spark",
          requestId,
        });
        await loadSnapshot(currentNode.id);
      } catch (error) {
        console.error("Failed to auto-generate root candidates:", error);
      } finally {
        clearStreamPreview();
        setIsProposing(false);
      }
    })();
  }, [isProposing, snapshot, workspaceId]);

  useEffect(() => {
    if (isEditing || readMode !== "full" || !showDetail) {
      setSelectedExcerpt("");
      setSelectionQuery("");
      return;
    }

    const syncSelection = () => {
      const selection = window.getSelection();
      const container = selectableContentRef.current;

      if (!selection || !container || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectedExcerpt("");
        return;
      }

      const anchorElement = getSelectionElement(selection.anchorNode);
      const focusElement = getSelectionElement(selection.focusNode);
      const selectedText = selection.toString().trim();

      if (!anchorElement || !focusElement || !selectedText) {
        setSelectedExcerpt("");
        return;
      }

      if (!container.contains(anchorElement) || !container.contains(focusElement)) {
        setSelectedExcerpt("");
        return;
      }

      setSelectedExcerpt(selectedText.slice(0, 800));
    };

    document.addEventListener("selectionchange", syncSelection);

    return () => {
      document.removeEventListener("selectionchange", syncSelection);
    };
  }, [isEditing, readMode, showDetail, snapshot?.current_node?.id]);

  useEffect(() => {
    setIsDeleteArmed(false);
  }, [snapshot?.current_node?.id]);

  useEffect(() => {
    if (!isDeleteArmed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsDeleteArmed(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isDeleteArmed]);

  const startStreamPreview = (label: string, operation: string) => {
    const requestId = crypto.randomUUID();
    streamRequestIdRef.current = requestId;
    setStreamLabel(label);
    setStreamOperation(operation);
    setStreamPreview("");
    setStreamError(null);
    return requestId;
  };

  const clearStreamPreview = () => {
    streamRequestIdRef.current = null;
    setStreamLabel(null);
    setStreamOperation(null);
    setStreamPreview("");
    setStreamError(null);
  };

  const clearSelectedExcerpt = () => {
    setSelectedExcerpt("");
    setSelectionQuery("");

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  const loadSnapshot = async (nodeId: string | null) => {
    try {
      const data = await invoke<WorkspaceSnapshot>("get_workspace_snapshot", {
        workspaceId,
        currentNodeId: nodeId,
      });
      setSnapshot(data);
      clearSelectedExcerpt();

      if (data.current_node) {
        setEditTitle(data.current_node.title);
        setEditBody(data.current_node.body ?? "");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadFullGraph = async () => {
    try {
      const data = await invoke<FullGraphData>("get_full_graph", { workspaceId });
      setFullGraph(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExpandWithPrompt = async (prompt: string, onSuccess?: () => void) => {
    if (!prompt.trim() || !snapshot?.current_node || isExpanding) {
      return;
    }

    const requestId = startStreamPreview("Live node generation", "expand_node");
    setIsExpanding(true);
    setShowDetail(true);

    try {
      const newNode = await invoke<TreeNode>("expand_node_with_ai", {
        workspaceId,
        parentNodeId: snapshot.current_node.id,
        query: prompt,
        requestId,
      });

      onSuccess?.();
      setCurrentNodeId(newNode.id);
      setShowDetail(true);
    } catch (error) {
      alert(error);
    } finally {
      clearStreamPreview();
      setIsExpanding(false);
    }
  };

  const handleExpand = async () => {
    await handleExpandWithPrompt(query, () => {
      setQuery("");
    });
  };

  const handleExpandFromSelection = async () => {
    if (!selectedExcerpt || !selectionQuery.trim()) {
      return;
    }

    const prompt = [
      "Use the selected passage as the primary context for the next node.",
      `Selected passage:\n\"\"\"\n${selectedExcerpt}\n\"\"\"`,
      `User question: ${selectionQuery.trim()}`,
    ].join("\n\n");

    await handleExpandWithPrompt(prompt, () => {
      clearSelectedExcerpt();
    });
  };

  const handlePropose = async () => {
    if (!query.trim() || !snapshot?.current_node || isProposing) {
      return;
    }

    const activeNodeId = snapshot.current_node.id;
    const requestId = startStreamPreview("Live branch prediction", "generate_candidates");
    setIsProposing(true);

    try {
      await invoke("generate_candidates", {
        workspaceId,
        nodeId: activeNodeId,
        query,
        requestId,
      });
      setQuery("");
      await loadSnapshot(activeNodeId);
    } catch (error) {
      alert(error);
    } finally {
      clearStreamPreview();
      setIsProposing(false);
    }
  };

  const handleAcceptCandidate = async (candidateId: string) => {
    const requestId = startStreamPreview("Live candidate expansion", "accept_candidate");
    setIsExpanding(true);
    setShowDetail(true);

    try {
      const node = await invoke<TreeNode>("accept_candidate", {
        candidateId,
        query: "Confirmed by user from suggestions.",
        requestId,
      });
      setCurrentNodeId(node.id);
      setShowDetail(true);
    } catch (error) {
      alert(error);
    } finally {
      clearStreamPreview();
      setIsExpanding(false);
    }
  };

  const handleSaveNode = async () => {
    if (!snapshot?.current_node || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await invoke("update_node", {
        nodeId: snapshot.current_node.id,
        input: {
          title: editTitle,
          body: editBody,
          summary: snapshot.current_node.summary,
          status: snapshot.current_node.status,
        },
      });
      setIsEditing(false);
      await loadSnapshot(currentNodeId);
    } catch (error) {
      alert(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrentNode = async () => {
    if (!snapshot?.current_node || isDeleting) {
      return;
    }

    if (!isDeleteArmed) {
      setIsDeleteArmed(true);
      return;
    }

    setIsDeleteArmed(false);
    setIsDeleting(true);

    try {
      const result = await invoke<DeleteNodeResult>("delete_node_branch", {
        nodeId: snapshot.current_node.id,
      });

      if (result.deleted_workspace) {
        onBack();
        return;
      }

      setCurrentNodeId(result.next_node_id);
      setShowDetail(Boolean(result.next_node_id));
    } catch (error) {
      alert(error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 className="h-12 w-12 animate-spin text-white/20" />
      </div>
    );
  }

  const isStreaming = Boolean(streamLabel || streamPreview || streamError);
  const isCandidateStreaming = isStreaming && streamOperation === "generate_candidates";
  const showPanel = Boolean(snapshot.current_node) && (showDetail || (isStreaming && !isCandidateStreaming));
  const bodyPreview = getBodyPreview(snapshot.current_node?.body);
  const hasCandidates = snapshot.recent_candidates.length > 0;
  const showCandidateRail = hasCandidates || isCandidateStreaming;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-transparent text-white selection:bg-blue-500/30">
      <nav className="pointer-events-none absolute left-8 top-8 z-30">
        <button
          onClick={onBack}
          className="pointer-events-auto group flex items-center gap-3 rounded-full border border-white/5 bg-white/5 px-5 py-2.5 backdrop-blur-xl transition-all active:scale-95 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 text-gray-400 transition-colors group-hover:text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 transition-colors group-hover:text-white">
            Orbit Exit
          </span>
        </button>
      </nav>

      <main className="relative z-10 flex-1">
        <div
          className={`h-full w-full p-4 pb-28 pt-24 transition-all duration-300 md:p-6 md:pb-32 md:pt-24 ${
            showPanel ? "lg:pr-[29rem]" : ""
          }`}
        >
          {isGlobalView && fullGraph ? (
            <KnowledgeGraph
              currentNode={snapshot.current_node}
              ancestors={[]}
              children={[]}
              edges={fullGraph.edges}
              allNodes={fullGraph.nodes}
              onNodeClick={(id) => {
                setCurrentNodeId(id);
                setIsGlobalView(false);
                setShowDetail(true);
              }}
            />
          ) : (
            <KnowledgeGraph
              currentNode={snapshot.current_node}
              ancestors={snapshot.ancestors}
              children={snapshot.children}
              edges={snapshot.edges}
              onNodeClick={(id) => {
                setCurrentNodeId(id);
                setShowDetail(true);
              }}
            />
          )}
        </div>

        <div className="pointer-events-none absolute left-0 right-0 top-24 z-20 flex justify-center px-4">
          <div className="rounded-full border border-white/8 bg-black/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 backdrop-blur-xl">
            Click any card to preview this branch
          </div>
        </div>

        <AnimatePresence>
          {showPanel && snapshot.current_node && (
            <motion.aside
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-4 bottom-24 top-24 z-40 md:inset-x-auto md:right-6 md:w-[24rem]"
            >
              <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.9),rgba(6,6,6,0.96))] shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
                <div className="border-b border-white/6 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">
                        {isStreaming ? "Live Preview" : "Node Preview"}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.24em] text-amber-200/75">
                        {snapshot.current_node.status}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          void handleDeleteCurrentNode();
                        }}
                        disabled={isDeleting}
                        title={isDeleteArmed ? "再次点击确认删除" : "删除当前主题或分支"}
                        className={`rounded-2xl p-3 transition-all disabled:opacity-40 ${
                          isDeleteArmed
                            ? "bg-red-500 text-white"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                        }`}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isDeleteArmed ? (
                          <span className="text-[10px] font-black uppercase tracking-[0.18em]">Delete</span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            void handleSaveNode();
                            return;
                          }

                          setIsEditing(true);
                        }}
                        className={`rounded-2xl p-3 transition-all ${
                          isEditing
                            ? "bg-white text-black"
                            : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isEditing ? (
                          <Save className="h-4 w-4" />
                        ) : (
                          <Edit3 className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowDetail(false);
                          setIsEditing(false);
                          clearSelectedExcerpt();
                        }}
                        className="rounded-2xl bg-white/5 p-3 text-gray-500 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setReadMode("summary")}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition-all ${
                          readMode === "summary"
                            ? "bg-amber-100 text-black"
                            : "bg-white/5 text-stone-500 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => setReadMode("full")}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition-all ${
                          readMode === "full"
                            ? "bg-blue-400 text-black"
                            : "bg-white/5 text-stone-500 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Full Read
                      </button>
                    </div>
                  )}
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5">
                  {isStreaming && (
                    <div className="mb-5 rounded-[1.75rem] border border-blue-500/20 bg-blue-500/6 p-4">
                      <div className="mb-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
                        <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_#60a5fa]" />
                        {streamLabel}
                      </div>
                      <div className="custom-scrollbar max-h-56 overflow-y-auto rounded-[1.25rem] bg-black/20 px-4 py-4">
                        {streamOperation === "generate_candidates" ? (
                          <StructuredCandidatesStreamPreview
                            rawPreview={streamPreview}
                            error={streamError}
                            waitingMessage="Predicting branch directions..."
                          />
                        ) : (
                          <StructuredStreamPreview
                            rawPreview={streamPreview}
                            error={streamError}
                            waitingMessage="Waiting for streamed output..."
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-5">
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="w-full bg-transparent text-3xl font-black uppercase tracking-tight text-white outline-none placeholder:text-white/10"
                      />
                      <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        className="min-h-[18rem] w-full resize-none rounded-[1.6rem] border border-white/8 bg-white/4 p-4 text-sm leading-relaxed text-stone-300 outline-none placeholder:text-white/10"
                        placeholder="Crystallize your findings here..."
                      />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">
                          Selected Node
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-white">
                          {snapshot.current_node.title}
                        </h1>
                      </div>

                      {readMode === "summary" ? (
                        <>
                          {snapshot.current_node.summary && (
                            <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
                              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-500">
                                Summary
                              </div>
                              <p className="text-sm font-medium italic leading-relaxed text-stone-200">
                                {snapshot.current_node.summary}
                              </p>
                            </div>
                          )}

                          <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-4">
                            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-500">
                              Body Preview
                            </div>
                            <p className="text-sm leading-relaxed text-stone-300">
                              {bodyPreview ?? "No deep context captured yet."}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div ref={selectableContentRef} className="space-y-5">
                            {snapshot.current_node.summary && (
                              <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
                                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-500">
                                  Summary
                                </div>
                                <p className="text-sm font-medium italic leading-relaxed text-stone-200">
                                  {snapshot.current_node.summary}
                                </p>
                              </div>
                            )}

                            <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-4">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-stone-500">
                                Body
                              </div>
                              {snapshot.current_node.body ? (
                                <MarkdownPreview
                                  content={snapshot.current_node.body}
                                  className="text-sm leading-relaxed text-stone-300"
                                />
                              ) : (
                                <p className="text-xs uppercase tracking-[0.24em] text-stone-600">
                                  No deep context captured yet.
                                </p>
                              )}
                            </div>
                          </div>

                          {selectedExcerpt && (
                            <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-50/5 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                              <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200/80">
                                    Selected Passage
                                  </p>
                                  <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-stone-300/80">
                                    {selectedExcerpt}
                                  </p>
                                </div>
                                <button
                                  onClick={clearSelectedExcerpt}
                                  className="shrink-0 rounded-2xl bg-white/5 p-2 text-stone-400 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="flex flex-col gap-3">
                                <input
                                  value={selectionQuery}
                                  onChange={(event) => setSelectionQuery(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      void handleExpandFromSelection();
                                    }
                                  }}
                                  disabled={isExpanding}
                                  placeholder="Ask a question about the selected text..."
                                  className="flex-1 rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-3 text-sm font-medium text-white outline-none placeholder:text-white/20"
                                />
                                <button
                                  onClick={() => {
                                    void handleExpandFromSelection();
                                  }}
                                  disabled={!selectionQuery.trim() || isExpanding}
                                  className="flex items-center justify-center gap-2 rounded-[1.5rem] bg-amber-100 px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-black transition-all hover:scale-[1.02] disabled:opacity-40"
                                >
                                  {isExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
                                  Generate Node
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {snapshot.recent_candidates.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">
                            <Sparkles className="h-3 w-3" />
                            Suggested Next Branches
                          </div>
                          <div className="space-y-3">
                            {snapshot.recent_candidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                className="w-full rounded-[1.5rem] border border-white/8 bg-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/8"
                                onClick={() => {
                                  void handleAcceptCandidate(candidate.id);
                                }}
                              >
                                <h5 className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-white">
                                  {candidate.title}
                                </h5>
                                <p className="text-[12px] leading-relaxed text-stone-400">
                                  {candidate.summary}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCandidateRail && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`absolute left-4 right-4 z-40 transition-all duration-300 md:left-6 md:right-6 ${
                showPanel ? "bottom-28 lg:right-[29rem]" : "bottom-28"
              }`}
            >
              <div className="rounded-[1.8rem] border border-white/10 bg-black/35 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-400">
                    <Sparkles className="h-3 w-3 text-blue-300" />
                    AI Branch Predictions
                  </div>
                  <button
                    onClick={() => setShowDetail(true)}
                    className="rounded-full bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-stone-500 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Open Preview
                  </button>
                </div>

                <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {isCandidateStreaming ? (
                    <StructuredCandidatesStreamPreview
                      rawPreview={streamPreview}
                      error={streamError}
                      waitingMessage="Predicting branch directions..."
                    />
                  ) : (
                    snapshot.recent_candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        onClick={() => {
                          void handleAcceptCandidate(candidate.id);
                        }}
                        className="min-w-[220px] max-w-[220px] shrink-0 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/8"
                      >
                        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.24em] text-blue-300/80">
                          AI Suggestion
                        </div>
                        <h5 className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-white line-clamp-2">
                          {candidate.title}
                        </h5>
                        <p className="line-clamp-3 text-[11px] leading-relaxed text-stone-400">
                          {candidate.summary}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`absolute bottom-4 left-4 right-4 z-50 transition-all duration-300 md:bottom-6 md:left-6 md:right-6 ${
            showPanel ? "lg:right-[29rem]" : ""
          }`}
        >
          <motion.div
            layout
            className="rounded-[2.5rem] border border-white/10 bg-neutral-900/60 p-3 shadow-[0_32px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/5">
                <Compass className={`h-5 w-5 text-gray-500 ${isExpanding || isProposing ? "animate-spin-slow" : ""}`} />
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={isExpanding || isProposing}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleExpand();
                  }
                }}
                placeholder={isExpanding ? "Synthesizing Thought..." : "Direct the flow of knowledge..."}
                className="flex-1 border-none bg-transparent text-lg font-bold text-white outline-none placeholder:text-white/10"
              />

              <div className="flex gap-2 rounded-2xl bg-white/5 p-1">
                <button
                  onClick={() => {
                    void handlePropose();
                  }}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-white disabled:opacity-20"
                >
                  Propose
                </button>
                <button
                  onClick={() => {
                    void handleExpand();
                  }}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-110 disabled:opacity-20"
                >
                  {isExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <div className="absolute right-8 top-8 z-30 flex items-center gap-4">
        <button
          onClick={() => setIsGlobalView((current) => !current)}
          className={`flex items-center gap-3 rounded-full border px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            isGlobalView
              ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)]"
              : "border-white/5 bg-white/5 text-gray-500 hover:border-white/20 hover:text-white"
          }`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          {isGlobalView ? "Focus" : "Full Orbit"}
        </button>
      </div>
    </div>
  );
}

function getSelectionElement(node: globalThis.Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) {
    return node;
  }

  if (node instanceof Text) {
    return node.parentElement;
  }

  return null;
}

function getBodyPreview(body: string | null | undefined): string | null {
  if (!body) {
    return null;
  }

  const normalized = markdownToPlainText(body);
  if (normalized.length <= 260) {
    return normalized;
  }

  return `${normalized.slice(0, 260).trimEnd()}...`;
}
