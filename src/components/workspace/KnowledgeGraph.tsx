import { useEffect } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Edge,
  Node,
  MarkerType,
  BackgroundVariant
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KnowledgeNode } from "./KnowledgeNode";

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
  onNodeClick 
}: KnowledgeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const centerX = 400;
    const centerY = 300;

    if (allNodes && allNodes.length > 0) {
      // Global View Layout: Simple Grid for MVP
      const cols = Math.ceil(Math.sqrt(allNodes.length));
      const gap = 250;
      
      allNodes.forEach((node, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        newNodes.push({
          id: node.id,
          type: "knowledge",
          position: { x: col * gap, y: row * gap },
          data: { label: node.title, summary: node.summary, status: node.status },
          selected: node.id === currentNode?.id,
        });
      });
    } else if (currentNode) {
      // Focus View Layout
      const vertGap = 180;
      const horizGap = 220;

      newNodes.push({
        id: currentNode.id,
        type: "knowledge",
        position: { x: centerX, y: centerY },
        data: { label: currentNode.title, summary: currentNode.summary, status: currentNode.status },
        selected: true,
      });

      const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
      if (parent) {
        newNodes.push({
          id: parent.id,
          type: "knowledge",
          position: { x: centerX, y: centerY - vertGap },
          data: { label: parent.title, summary: parent.summary, status: parent.status },
        });
      }

      children.forEach((child, index) => {
        const offset = (index - (children.length - 1) / 2) * horizGap;
        newNodes.push({
          id: child.id,
          type: "knowledge",
          position: { x: centerX + offset, y: centerY + vertGap },
          data: { label: child.title, summary: child.summary, status: child.status },
        });
      });
    }

    edges.forEach(edge => {
      const isHierarchy = edge.relation_type === "hierarchy";
      newEdges.push({
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        type: "smoothstep",
        animated: !isHierarchy,
        interactionWidth: 20,
        style: { 
          stroke: isHierarchy ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.4)", 
          strokeWidth: isHierarchy ? 1 : 2,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: isHierarchy ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.4)",
          width: 20,
          height: 20,
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [currentNode?.id, ancestors.length, children.length, edges.length, allNodes?.length]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#f1f5f9" variant={BackgroundVariant.Dots} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
