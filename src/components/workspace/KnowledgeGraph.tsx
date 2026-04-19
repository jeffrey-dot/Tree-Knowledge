import { useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  type Edge,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KnowledgeNode, type KnowledgeGraphNode } from "./KnowledgeNode";

const nodeTypes = {
  knowledge: KnowledgeNode,
};

interface NodeData {
  id: string;
  title: string;
  summary: string | null;
  status: string;
}

interface EdgeData {
  id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
}

interface KnowledgeGraphProps {
  currentNode: NodeData | null;
  ancestors: NodeData[];
  children: NodeData[];
  edges: EdgeData[];
  allNodes?: NodeData[];
  onNodeClick: (id: string) => void;
}

export default function KnowledgeGraph({
  currentNode,
  ancestors,
  children,
  edges,
  allNodes,
  onNodeClick,
}: KnowledgeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<KnowledgeGraphNode>([]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const newNodes: KnowledgeGraphNode[] = [];
    const newEdges: Edge[] = [];

    if (allNodes && allNodes.length > 0) {
      const columns = Math.max(2, Math.ceil(Math.sqrt(allNodes.length)));
      const horizontalGap = 360;
      const verticalGap = 260;

      allNodes.forEach((node, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const horizontalOffset = row % 2 === 0 ? 0 : horizontalGap / 2;
        const verticalOffset = column % 2 === 0 ? 0 : 30;
        const relationMeta = getNodeRelationMeta(node.id, edges, {
          fallbackLabel: node.id === currentNode?.id ? "focus" : null,
        });

        newNodes.push({
          id: node.id,
          type: "knowledge",
          draggable: false,
          selectable: false,
          position: {
            x: column * horizontalGap + horizontalOffset,
            y: row * verticalGap + verticalOffset,
          },
          data: {
            label: node.title,
            summary: node.summary,
            status: node.status,
            relationLabel: relationMeta.label,
            relationTone: relationMeta.tone,
          },
          selected: node.id === currentNode?.id,
        });
      });
    } else if (currentNode) {
      const centerX = 620;
      const centerY = 260;
      const parentGap = 250;
      const childGap = 340;

      newNodes.push({
        id: currentNode.id,
        type: "knowledge",
        draggable: false,
        selectable: false,
        position: { x: centerX, y: centerY },
        data: {
          label: currentNode.title,
          summary: currentNode.summary,
          status: currentNode.status,
          relationLabel: "focus",
          relationTone: "border-amber-200/20 bg-amber-200/8 text-amber-100/90",
        },
        selected: true,
      });

      const visibleAncestors = ancestors.slice(-2);
      visibleAncestors.forEach((ancestor, index) => {
        const depth = visibleAncestors.length - index;
        const lateralOffset = depth % 2 === 0 ? -120 : 120;

        newNodes.push({
          id: ancestor.id,
          type: "knowledge",
          draggable: false,
          selectable: false,
          position: {
            x: centerX + lateralOffset,
            y: centerY - parentGap * depth,
          },
          data: {
            label: ancestor.title,
            summary: ancestor.summary,
            status: ancestor.status,
            relationLabel: "parent",
            relationTone: "border-stone-200/14 bg-stone-200/6 text-stone-200/70",
          },
        });
      });

      children.forEach((child, index) => {
        const row = Math.floor(index / 3);
        const column = index % 3;
        const rowChildren = children.slice(row * 3, row * 3 + 3).length;
        const spread = (column - (rowChildren - 1) / 2) * childGap;
        const relationMeta = getNodeRelationMeta(child.id, edges, {
          fallbackLabel: "child",
        });

        newNodes.push({
          id: child.id,
          type: "knowledge",
          draggable: false,
          selectable: false,
          position: {
            x: centerX + spread + (row % 2 === 0 ? 0 : 90),
            y: centerY + 240 + row * 240,
          },
          data: {
            label: child.title,
            summary: child.summary,
            status: child.status,
            relationLabel: relationMeta.label,
            relationTone: relationMeta.tone,
          },
        });
      });
    }

    edges.forEach((edge) => {
      newEdges.push({
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        type: "smoothstep",
        animated: false,
        selectable: false,
        style: getEdgeStyle(edge.relation_type),
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [allNodes, ancestors, children, currentNode, edges, setEdges, setNodes]);

  return (
    <div className="knowledge-wall relative h-full w-full overflow-hidden rounded-[2.5rem] border border-white/6 bg-[#060606]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_28%)]" />
      <ReactFlow<KnowledgeGraphNode, Edge>
        nodes={nodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.75 }}
        minZoom={0.5}
        maxZoom={1.4}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        className="knowledge-wall-flow"
      >
        <Background
          color="rgba(255,255,255,0.035)"
          variant={BackgroundVariant.Lines}
          gap={48}
          size={1}
        />
      </ReactFlow>
    </div>
  );
}

function getEdgeStyle(relationType: string): Edge["style"] {
  if (relationType === "hierarchy") {
    return {
      stroke: "rgba(232, 220, 190, 0.34)",
      strokeWidth: 1.6,
    };
  }

  if (relationType === "supports") {
    return {
      stroke: "rgba(74, 222, 128, 0.32)",
      strokeWidth: 1.5,
      strokeDasharray: "3 7",
    };
  }

  if (relationType === "contrasts") {
    return {
      stroke: "rgba(248, 113, 113, 0.34)",
      strokeWidth: 1.5,
      strokeDasharray: "10 8",
    };
  }

  if (relationType === "depends_on") {
    return {
      stroke: "rgba(251, 191, 36, 0.3)",
      strokeWidth: 1.5,
      strokeDasharray: "2 8",
    };
  }

  return {
    stroke: "rgba(96, 165, 250, 0.28)",
    strokeWidth: 1.4,
    strokeDasharray: "6 8",
  };
}

function getNodeRelationMeta(
  nodeId: string,
  edges: EdgeData[],
  options: { fallbackLabel: string | null },
): { label: string | null; tone: string } {
  const semanticEdge = edges.find(
    (edge) =>
      edge.relation_type !== "hierarchy" &&
      (edge.from_node_id === nodeId || edge.to_node_id === nodeId),
  );

  if (!semanticEdge) {
    return {
      label: options.fallbackLabel,
      tone: getRelationTone(options.fallbackLabel),
    };
  }

  return {
    label: semanticEdge.relation_type.replace(/_/g, " "),
    tone: getRelationTone(semanticEdge.relation_type),
  };
}

function getRelationTone(relationType: string | null): string {
  switch (relationType) {
    case "focus":
      return "border-amber-200/20 bg-amber-200/8 text-amber-100/90";
    case "parent":
      return "border-stone-200/14 bg-stone-200/6 text-stone-200/70";
    case "child":
      return "border-blue-300/18 bg-blue-300/8 text-blue-200/80";
    case "supports":
      return "border-emerald-300/22 bg-emerald-300/8 text-emerald-200/90";
    case "contrasts":
      return "border-rose-300/20 bg-rose-300/8 text-rose-200/90";
    case "depends_on":
      return "border-amber-300/22 bg-amber-300/8 text-amber-200/90";
    case "related_to":
      return "border-sky-300/22 bg-sky-300/8 text-sky-200/90";
    default:
      return "border-white/12 bg-white/5 text-stone-300/70";
  }
}
