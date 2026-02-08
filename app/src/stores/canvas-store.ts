import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import type { CanvasNodeData, ProductNodeData, SubredditNodeData, ExamplePostNodeData, GeneratedPostNodeData } from '@/types';

interface CanvasStore {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId: string | null;
  isDirty: boolean;
  projectId: string | null;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // State setters
  setNodes: (nodes: Node<CanvasNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  setSelectedNodeId: (id: string | null) => void;
  setProjectId: (id: string) => void;

  // Node operations
  addNode: (node: Node<CanvasNodeData>) => void;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
  removeNode: (id: string) => void;

  // Canvas operations
  loadCanvasState: (nodes: Node<CanvasNodeData>[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
  markClean: () => void;

  // Helpers
  getProductNode: () => Node<ProductNodeData> | undefined;
  getSelectedExamplePosts: () => Node<ExamplePostNodeData>[];
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  isDirty: false,
  projectId: null,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge({ ...connection, animated: true }, get().edges),
      isDirty: true,
    });
  },

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),
  setViewport: (viewport) => set({ viewport }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setProjectId: (id) => set({ projectId: id }),

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } as CanvasNodeData }
          : node
      ),
      isDirty: true,
    }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      isDirty: true,
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },

  loadCanvasState: (nodes, edges, viewport) => {
    set({ nodes, edges, viewport, isDirty: false });
  },

  markClean: () => set({ isDirty: false }),

  getProductNode: () => {
    return get().nodes.find(
      (n) => n.data.type === 'product'
    ) as Node<ProductNodeData> | undefined;
  },

  getSelectedExamplePosts: () => {
    return get().nodes.filter(
      (n) => n.data.type === 'example-post' && (n.data as ExamplePostNodeData).selected
    ) as Node<ExamplePostNodeData>[];
  },
}));
