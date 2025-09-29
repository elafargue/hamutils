import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCw, Eye, EyeOff, Shuffle, Network, Target, Save, Download } from 'lucide-react';

interface AX25Node {
  id: string;
  label: string;
  is_hearable: boolean;
  packet_count: number;
  type: 'hearable' | 'relay';
}

interface AX25Edge {
  id: string;
  source: string;
  target: string;
  label: string;
  count: number;
}

interface TopologyData {
  nodes: AX25Node[];
  edges: AX25Edge[];
  hearable_nodes: string[];
  stats: {
    total_nodes: number;
    total_edges: number;
    hearable_count: number;
    last_updated?: string; // Optional since backend might not provide it
  };
}

// Custom Node component with handles on all four sides
const AX25CustomNode: React.FC<NodeProps> = ({ data }) => {
  const isHearable = data.is_hearable || false;
  const isLeaf = data.isLeaf || false;
  const packetCount = data.packet_count || 0;
  const isConnected = data.isConnected || false;
  const isSelected = data.isSelected || false;
  
  // Determine background and border colors based on node type (following legend)
  const getNodeColors = () => {
    // Handle selection highlighting first
    if (isSelected) {
      return {
        background: '#10b981', // Dark green for selected node
        border: '3px solid #059669', // Darker green border
        textColor: '#ffffff'
      };
    } else if (isConnected) {
      return {
        background: '#86efac', // Light green for connected nodes
        border: '2px solid #22c55e', // Medium green border
        textColor: '#166534'
      };
    }
    
    // Original node type colors (following the legend)
    if (isHearable) {
      return {
        background: '#ffd700', // Gold background
        border: '2px solid #ff6600', // Orange border
        textColor: '#92400e' // Dark amber text
      };
    } else if (isLeaf) {
      return {
        background: '#dbeafe', // Clear blue background
        border: '2px solid #ea580c', // Orange outline
        textColor: '#1e3a8a' // Dark blue text
      };
    } else {
      // Repeater nodes (default)
      return {
        background: '#f0f9ff', // Very light blue background
        border: '2px solid #3b82f6', // Blue border
        textColor: '#1d4ed8' // Blue text
      };
    }
  };
  
  const nodeColors = getNodeColors();
  
  return (
    <div 
      style={{
        background: nodeColors.background,
        border: nodeColors.border,
        borderRadius: '8px',
        padding: '8px 12px',
        minWidth: '60px',
        textAlign: 'center',
        fontSize: '12px',
        color: nodeColors.textColor,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: 'pointer'
      }}
    >
      {/* Handles for all four directions - target handles invisible, source handles visible */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ opacity: 0, width: '6px', height: '6px', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={{ background: '#6b7280', width: '6px', height: '6px', border: 'none' }}
      />
      
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={{ opacity: 0, width: '6px', height: '6px', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#6b7280', width: '6px', height: '6px', border: 'none' }}
      />
      
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        style={{ opacity: 0, width: '6px', height: '6px', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#6b7280', width: '6px', height: '6px', border: 'none' }}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ opacity: 0, width: '6px', height: '6px', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: '#6b7280', width: '6px', height: '6px', border: 'none' }}
      />
      
      <div style={{ fontWeight: '600', marginBottom: '2px', fontSize: '13px' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '10px', color: '#6b7280' }}>
        {packetCount} pkts
        {isHearable && <span style={{ color: '#10b981', marginLeft: '4px' }}>📡</span>}
      </div>
    </div>
  );
};

// Node types definition
const nodeTypes = {
  ax25Node: AX25CustomNode,
};

// Edge bundling algorithm to group similar edges for visual clarity
const bundleEdges = (edges: AX25Edge[], positions: Map<string, {x: number, y: number}>): AX25Edge[] => {
  const bundledEdges: AX25Edge[] = [];
  const processedEdges = new Set<string>();
  
  edges.forEach((edge, index) => {
    if (processedEdges.has(edge.id)) return;
    
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    if (!sourcePos || !targetPos) {
      bundledEdges.push(edge);
      return;
    }
    
    // Find edges with similar angles (within 30 degrees)
    const edgeAngle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
    const similarEdges = [edge];
    
    edges.forEach((otherEdge, otherIndex) => {
      if (otherIndex <= index || processedEdges.has(otherEdge.id)) return;
      
      const otherSourcePos = positions.get(otherEdge.source);
      const otherTargetPos = positions.get(otherEdge.target);
      if (!otherSourcePos || !otherTargetPos) return;
      
      const otherAngle = Math.atan2(otherTargetPos.y - otherSourcePos.y, otherTargetPos.x - otherSourcePos.x);
      const angleDiff = Math.abs(edgeAngle - otherAngle);
      
      // Check if edges are roughly parallel and close together
      if (angleDiff < Math.PI / 6 || angleDiff > (11 * Math.PI) / 6) {
        const distance = Math.sqrt(
          Math.pow((sourcePos.x + targetPos.x) / 2 - (otherSourcePos.x + otherTargetPos.x) / 2, 2) +
          Math.pow((sourcePos.y + targetPos.y) / 2 - (otherSourcePos.y + otherTargetPos.y) / 2, 2)
        );
        
        if (distance < 150) { // Bundle edges within 150px of each other
          similarEdges.push(otherEdge);
          processedEdges.add(otherEdge.id);
        }
      }
    });
    
    bundledEdges.push(...similarEdges);
    processedEdges.add(edge.id);
  });
  
  return bundledEdges;
};

// Calculate dynamic anchor points for edges to minimize visual clutter
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const calculateOptimalAnchorPoints = (sourcePos: {x: number, y: number}, targetPos: {x: number, y: number}, sourceSize: {width: number, height: number}, targetSize: {width: number, height: number}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dx = targetPos.x - sourcePos.x;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dy = targetPos.y - sourcePos.y;
  
  // Calculate intersection points with node boundaries
  const sourceAnchors = [
    { x: sourcePos.x + sourceSize.width/2, y: sourcePos.y, side: 'top' },
    { x: sourcePos.x + sourceSize.width/2, y: sourcePos.y + sourceSize.height, side: 'bottom' },
    { x: sourcePos.x, y: sourcePos.y + sourceSize.height/2, side: 'left' },
    { x: sourcePos.x + sourceSize.width, y: sourcePos.y + sourceSize.height/2, side: 'right' }
  ];
  
  const targetAnchors = [
    { x: targetPos.x + targetSize.width/2, y: targetPos.y, side: 'top' },
    { x: targetPos.x + targetSize.width/2, y: targetPos.y + targetSize.height, side: 'bottom' },
    { x: targetPos.x, y: targetPos.y + targetSize.height/2, side: 'left' },
    { x: targetPos.x + targetSize.width, y: targetPos.y + targetSize.height/2, side: 'right' }
  ];
  
  // Find optimal anchor points that minimize edge length
  let bestDistance = Infinity;
  let bestSourceAnchor = sourceAnchors[0];
  let bestTargetAnchor = targetAnchors[0];
  
  sourceAnchors.forEach(sAnchor => {
    targetAnchors.forEach(tAnchor => {
      const dist = Math.sqrt(
        Math.pow(tAnchor.x - sAnchor.x, 2) + 
        Math.pow(tAnchor.y - sAnchor.y, 2)
      );
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSourceAnchor = sAnchor;
        bestTargetAnchor = tAnchor;
      }
    });
  });
  
  return { source: bestSourceAnchor, target: bestTargetAnchor };
};

// Layout quality assessment metrics
const assessLayoutQuality = (nodes: AX25Node[], edges: AX25Edge[], positions: Map<string, {x: number, y: number}>) => {
  // Count edge crossings
  const edgePositions = edges.map(edge => ({
    source: positions.get(edge.source)!,
    target: positions.get(edge.target)!
  })).filter(e => e.source && e.target);
  
  const crossings = countEdgeCrossings(edgePositions);
  
  // Calculate node overlap penalty
  let overlapPenalty = 0;
  const nodeArray = Array.from(positions.entries());
  for (let i = 0; i < nodeArray.length; i++) {
    for (let j = i + 1; j < nodeArray.length; j++) {
      const [, posA] = nodeArray[i];
      const [, posB] = nodeArray[j];
      const distance = Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
      if (distance < 100) { // Nodes too close
        overlapPenalty += (100 - distance);
      }
    }
  }
  
  // Calculate angular resolution (how well distributed are edge angles)
  let angularResolution = 0;
  nodes.forEach(node => {
    const nodeEdges = edges.filter(e => e.source === node.id || e.target === node.id);
    if (nodeEdges.length > 1) {
      const angles: number[] = [];
      nodeEdges.forEach(edge => {
        const otherNodeId = edge.source === node.id ? edge.target : edge.source;
        const otherPos = positions.get(otherNodeId);
        const nodePos = positions.get(node.id);
        if (otherPos && nodePos) {
          const angle = Math.atan2(otherPos.y - nodePos.y, otherPos.x - nodePos.x);
          angles.push(angle);
        }
      });
      
      // Calculate minimum angle between adjacent edges
      angles.sort();
      for (let i = 0; i < angles.length; i++) {
        const nextIndex = (i + 1) % angles.length;
        let angleDiff = Math.abs(angles[nextIndex] - angles[i]);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        angularResolution += angleDiff;
      }
    }
  });
  
  return {
    crossings,
    overlapPenalty: Math.round(overlapPenalty),
    angularResolution: Math.round(angularResolution * 100) / 100,
    totalScore: crossings * 10 + overlapPenalty + (Math.PI * 4 - angularResolution) * 5
  };
};

// Count edge crossings for layout quality assessment
const countEdgeCrossings = (edges: Array<{source: {x: number, y: number}, target: {x: number, y: number}}>) => {
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const edge1 = edges[i];
      const edge2 = edges[j];
      
      // Check if edges intersect using line intersection formula
      const det = (edge1.target.x - edge1.source.x) * (edge2.target.y - edge2.source.y) - 
                  (edge1.target.y - edge1.source.y) * (edge2.target.x - edge2.source.x);
      
      if (Math.abs(det) > 1e-10) {
        const u = ((edge2.source.x - edge1.source.x) * (edge2.target.y - edge2.source.y) - 
                   (edge2.source.y - edge1.source.y) * (edge2.target.x - edge2.source.x)) / det;
        const v = ((edge2.source.x - edge1.source.x) * (edge1.target.y - edge1.source.y) - 
                   (edge2.source.y - edge1.source.y) * (edge1.target.x - edge1.source.x)) / det;
        
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          crossings++;
        }
      }
    }
  }
  return crossings;
};

// Simple straight-line layout algorithm for cleaner, more geometric arrangements
const calculateStraightLinePositions = (nodes: AX25Node[], edges: AX25Edge[], width: number, height: number): Map<string, { x: number; y: number }> => {
  if (nodes.length === 0) return new Map();
  
  const positions = new Map();
  
  // Separate hearable nodes and others
  const hearableNodes = nodes.filter(n => n.is_hearable);
  const otherNodes = nodes.filter(n => !n.is_hearable);
  
  // Create adjacency map
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  
  if (hearableNodes.length === 0) {
    // No hearable nodes - arrange in a grid
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const xSpacing = Math.min(width / (cols + 1), 200);
    const ySpacing = Math.min(height / (rows + 1), 150);
    
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.set(node.id, {
        x: (col + 1) * xSpacing,
        y: (row + 1) * ySpacing
      });
    });
  } else {
    // Place hearable nodes in center horizontally
    const centerY = height / 2;
    const hearableSpacing = Math.min(width / (hearableNodes.length + 1), 200);
    
    hearableNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: (index + 1) * hearableSpacing,
        y: centerY
      });
    });
    
    // Arrange other nodes in straight lines radiating from hearable nodes
    const processedNodes = new Set(hearableNodes.map(n => n.id));
    
    hearableNodes.forEach((hearableNode, hearableIndex) => {
      const hearablePos = positions.get(hearableNode.id)!;
      const connectedNodes = otherNodes.filter(node => 
        adjacency.get(hearableNode.id)?.has(node.id) && !processedNodes.has(node.id)
      );
      
      if (connectedNodes.length > 0) {
        // Calculate angle for this hearable node's connections
        const baseAngle = (hearableIndex * 2 * Math.PI) / hearableNodes.length;
        const angleStep = Math.PI / (connectedNodes.length + 1);
        
        connectedNodes.forEach((node, nodeIndex) => {
          const angle = baseAngle + (nodeIndex - connectedNodes.length / 2) * angleStep;
          const distance = 200 + (nodeIndex % 2) * 100; // Staggered distances
          
          positions.set(node.id, {
            x: hearablePos.x + Math.cos(angle) * distance,
            y: hearablePos.y + Math.sin(angle) * distance
          });
          
          processedNodes.add(node.id);
        });
      }
    });
    
    // Place remaining unconnected nodes in a grid at the bottom
    const remainingNodes = otherNodes.filter(node => !processedNodes.has(node.id));
    if (remainingNodes.length > 0) {
      const cols = Math.ceil(Math.sqrt(remainingNodes.length));
      const xSpacing = Math.min(width / (cols + 1), 150);
      const startY = height - 200;
      
      remainingNodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions.set(node.id, {
          x: (col + 1) * xSpacing,
          y: startY + row * 80
        });
      });
    }
  }
  
  // Ensure all positions are within bounds
  positions.forEach((pos, nodeId) => {
    pos.x = Math.max(80, Math.min(width - 80, pos.x));
    pos.y = Math.max(80, Math.min(height - 80, pos.y));
  });
  
  return positions;
};

// Fruchterman-Reingold force-directed layout algorithm with edge crossing minimization
const calculateNodePositions = (nodes: AX25Node[], edges: AX25Edge[], width: number, height: number): Map<string, { x: number; y: number }> => {
  if (nodes.length === 0) return new Map();
  
  const positions = new Map();
  const velocities = new Map();
  const nodeSize = new Map();
  
  // Initialize positions and calculate node sizes
  nodes.forEach(node => {
    positions.set(node.id, {
      x: Math.random() * (width - 200) + 100,
      y: Math.random() * (height - 200) + 100
    });
    velocities.set(node.id, { x: 0, y: 0 });
    
    // Store node dimensions for anchor point calculation
    const isHearable = node.is_hearable;
    const isLeaf = edges.filter(e => e.source === node.id || e.target === node.id).length <= 1;
    nodeSize.set(node.id, {
      width: isHearable ? 140 : isLeaf ? 100 : 120,
      height: isHearable ? 70 : isLeaf ? 50 : 60
    });
  });
  
  // Fruchterman-Reingold parameters
  const area = width * height;
  const k = Math.sqrt(area / nodes.length); // Optimal distance between nodes
  const iterations = 300; // More iterations for better convergence
  const initialTemp = Math.sqrt(area) / 10;
  
  // Create adjacency map
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  
  // Calculate node importance for prioritized positioning
  const importance = new Map();
  nodes.forEach(node => {
    const connections = adjacency.get(node.id)?.size || 0;
    const hearableBonus = node.is_hearable ? 20 : 0;
    const packetBonus = Math.log(node.packet_count + 1) * 3;
    importance.set(node.id, connections + hearableBonus + packetBonus);
  });
  
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = initialTemp * (1 - iter / iterations);
    
    // Reset forces
    const forces = new Map();
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });
    
    // Repulsive forces (Fruchterman-Reingold)
    nodes.forEach(nodeA => {
      nodes.forEach(nodeB => {
        if (nodeA.id !== nodeB.id) {
          const posA = positions.get(nodeA.id);
          const posB = positions.get(nodeB.id);
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          // Enhanced repulsion based on node importance
          const importanceA = importance.get(nodeA.id) || 1;
          const importanceB = importance.get(nodeB.id) || 1;
          const repulsionFactor = Math.sqrt(importanceA * importanceB);
          const repulsion = (k * k * repulsionFactor) / distance;
          
          const forceA = forces.get(nodeA.id);
          forceA.x += (dx / distance) * repulsion;
          forceA.y += (dy / distance) * repulsion;
        }
      });
    });
    
    // Attractive forces for connected nodes
    edges.forEach(edge => {
      const posSource = positions.get(edge.source);
      const posTarget = positions.get(edge.target);
      if (posSource && posTarget) {
        const dx = posTarget.x - posSource.x;
        const dy = posTarget.y - posSource.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
        
        // Edge weight affects ideal distance
        const edgeWeight = Math.log(edge.count + 1);
        const idealDistance = k * (1 + edgeWeight * 0.3);
        const attraction = (distance * distance) / idealDistance;
        
        const forceSource = forces.get(edge.source);
        const forceTarget = forces.get(edge.target);
        
        forceSource.x += (dx / distance) * attraction;
        forceSource.y += (dy / distance) * attraction;
        forceTarget.x -= (dx / distance) * attraction;
        forceTarget.y -= (dy / distance) * attraction;
      }
    });
    
    // Apply center gravity for hearable nodes
    const centerX = width / 2;
    const centerY = height / 2;
    nodes.forEach(node => {
      if (node.is_hearable) {
        const pos = positions.get(node.id);
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;
        const centerForce = 0.01 * temperature;
        
        const force = forces.get(node.id);
        force.x += dx * centerForce;
        force.y += dy * centerForce;
      }
    });
    
    // Update positions based on forces
    nodes.forEach(node => {
      const force = forces.get(node.id);
      const position = positions.get(node.id);
      const mass = importance.get(node.id) || 1;
      
      // Limit displacement by temperature and mass
      const displacement = Math.sqrt(force.x * force.x + force.y * force.y) || 0.1;
      const maxDisplacement = Math.min(displacement, temperature) / Math.sqrt(mass);
      
      position.x += (force.x / displacement) * maxDisplacement;
      position.y += (force.y / displacement) * maxDisplacement;
      
      // Keep nodes within canvas bounds
      const margin = 80;
      position.x = Math.max(margin, Math.min(width - margin, position.x));
      position.y = Math.max(margin, Math.min(height - margin, position.y));
    });
    
    // Every 100 iterations, assess layout quality and optimize (reduced from 50 for performance)
    if (iter % 100 === 0 && iter > 0) {
      const qualityMetrics = assessLayoutQuality(nodes, edges, positions);
      
      // If quality is poor, apply optimization strategies
      if (qualityMetrics.crossings > 5 || qualityMetrics.overlapPenalty > 200) {
        // Strategy 1: Increase repulsion for overlapping nodes
        nodes.forEach(nodeA => {
          nodes.forEach(nodeB => {
            if (nodeA.id !== nodeB.id) {
              const posA = positions.get(nodeA.id);
              const posB = positions.get(nodeB.id);
              const dx = posA.x - posB.x;
              const dy = posA.y - posB.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
              
              if (distance < 120) { // Apply extra repulsion for close nodes
                const extraRepulsion = (120 - distance) * 2;
                posA.x += (dx / distance) * extraRepulsion;
                posA.y += (dy / distance) * extraRepulsion;
                posB.x -= (dx / distance) * extraRepulsion;
                posB.y -= (dy / distance) * extraRepulsion;
              }
            }
          });
        });
        
        // Strategy 2: Perturb high-crossing nodes
        if (qualityMetrics.crossings > 3) {
          const perturbation = temperature * 0.2;
          nodes.forEach(node => {
            const pos = positions.get(node.id);
            pos.x += (Math.random() - 0.5) * perturbation;
            pos.y += (Math.random() - 0.5) * perturbation;
          });
        }
      }
      
      // Log quality metrics for debugging (remove in production)
      if (iter % 100 === 0) {
        console.log(`Iteration ${iter} - Quality: Crossings=${qualityMetrics.crossings}, Overlap=${qualityMetrics.overlapPenalty}, Angular=${qualityMetrics.angularResolution}, Score=${qualityMetrics.totalScore}`);
      }
    }
  }
  
  return positions;
};

// SFDP (Spring Force-Directed Placement) algorithm - GraphViz style with overlap prevention
const calculateSFDPPositions = (nodes: AX25Node[], edges: AX25Edge[], width: number, height: number): Map<string, { x: number; y: number }> => {
  if (nodes.length === 0) return new Map();
  
  const positions = new Map();
  const velocities = new Map();
  const nodeSize = new Map();
  
  // Initialize positions in a grid to reduce initial overlaps (GraphViz style)
  const gridSize = Math.ceil(Math.sqrt(nodes.length));
  const cellWidth = (width - 200) / gridSize;
  const cellHeight = (height - 200) / gridSize;
  
  nodes.forEach((node, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    
    // Add some randomization within grid cells
    const baseX = col * cellWidth + cellWidth / 2 + 100;
    const baseY = row * cellHeight + cellHeight / 2 + 100;
    const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
    const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
    
    positions.set(node.id, {
      x: baseX + jitterX,
      y: baseY + jitterY
    });
    velocities.set(node.id, { x: 0, y: 0 });
    
    // Calculate node dimensions
    const isHearable = node.is_hearable;
    const connections = edges.filter(e => e.source === node.id || e.target === node.id).length;
    const isLeaf = connections <= 1;
    nodeSize.set(node.id, {
      width: isHearable ? 140 : isLeaf ? 100 : 120,
      height: isHearable ? 70 : isLeaf ? 50 : 60,
      connections
    });
  });
  
  // Build adjacency list for edge forces
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  
  // SFDP-style multi-scale iterations with different parameters
  const phases = [
    { iterations: 150, repulsion: 8000, attraction: 2.0, minDistance: 100, temperature: 200 },
    { iterations: 100, repulsion: 4000, attraction: 1.5, minDistance: 80, temperature: 100 },
    { iterations: 80, repulsion: 2000, attraction: 1.0, minDistance: 60, temperature: 50 },
    { iterations: 50, repulsion: 1000, attraction: 0.8, minDistance: 40, temperature: 25 }
  ];
  
  phases.forEach(phase => {
    for (let iter = 0; iter < phase.iterations; iter++) {
      const currentTemp = phase.temperature * (1 - iter / phase.iterations);
      const forces = new Map();
      nodes.forEach(node => forces.set(node.id, { x: 0, y: 0 }));
      
      // Repulsive forces (all pairs) - stronger than standard for overlap prevention
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i];
          const nodeB = nodes[j];
          const posA = positions.get(nodeA.id);
          const posB = positions.get(nodeB.id);
          
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          // Enhanced overlap prevention (prism-like behavior)
          const sizeA = nodeSize.get(nodeA.id);
          const sizeB = nodeSize.get(nodeB.id);
          const minSeparation = Math.max(sizeA.width, sizeA.height) / 2 + Math.max(sizeB.width, sizeB.height) / 2 + phase.minDistance;
          
          if (distance < minSeparation * 2) {
            // Strong repulsion for close nodes (prism overlap prevention)
            const overlapFactor = distance < minSeparation ? 3.0 : 1.0;
            const repulsiveForce = (phase.repulsion * overlapFactor) / (distance * distance);
            const fx = (dx / distance) * repulsiveForce;
            const fy = (dy / distance) * repulsiveForce;
            
            forces.get(nodeA.id).x += fx;
            forces.get(nodeA.id).y += fy;
            forces.get(nodeB.id).x -= fx;
            forces.get(nodeB.id).y -= fy;
          }
        }
      }
      
      // Attractive forces (connected nodes only) - SFDP style
      edges.forEach(edge => {
        const posA = positions.get(edge.source);
        const posB = positions.get(edge.target);
        
        if (posA && posB) {
          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          // Ideal edge length based on connection density
          const connectionsA = nodeSize.get(edge.source).connections;
          const connectionsB = nodeSize.get(edge.target).connections;
          const idealLength = 150 + (connectionsA + connectionsB) * 10;
          
          const attractiveForce = phase.attraction * (distance - idealLength) / distance;
          const fx = dx * attractiveForce;
          const fy = dy * attractiveForce;
          
          forces.get(edge.source).x += fx;
          forces.get(edge.source).y += fy;
          forces.get(edge.target).x -= fx;
          forces.get(edge.target).y -= fy;
        }
      });
      
      // Apply forces with temperature cooling (SFDP style)
      nodes.forEach(node => {
        const force = forces.get(node.id);
        const position = positions.get(node.id);
        const velocity = velocities.get(node.id);
        
        // Add momentum for smoother movement
        velocity.x = velocity.x * 0.8 + force.x * 0.2;
        velocity.y = velocity.y * 0.8 + force.y * 0.2;
        
        // Apply movement with temperature control
        const displacement = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y) || 0.1;
        const maxDisplacement = Math.min(displacement, currentTemp);
        
        position.x += (velocity.x / displacement) * maxDisplacement;
        position.y += (velocity.y / displacement) * maxDisplacement;
        
        // Boundary constraints with padding
        const margin = 100;
        position.x = Math.max(margin, Math.min(width - margin, position.x));
        position.y = Math.max(margin, Math.min(height - margin, position.y));
      });
    }
  });
  
  return positions;
};

const TopologyViewerContent: React.FC = () => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [allNodes, setAllNodes] = useState<AX25Node[]>([]);
  const [allEdges, setAllEdges] = useState<AX25Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showLeafNodes, setShowLeafNodes] = useState(true);
  const [stats, setStats] = useState({
    total_nodes: 0,
    total_edges: 0,
    hearable_count: 0,
    last_updated: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [layoutQuality, setLayoutQuality] = useState({
    crossings: 0,
    overlapPenalty: 0,
    angularResolution: 0,
    totalScore: 0,
    grade: 'A'
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'fruchterman' | 'straight' | 'sfdp'>('fruchterman');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { fitView } = useReactFlow();
  // Refs for performance optimization and timing control
  const isUpdatingAnchors = useRef(false);
  const isSelectingNode = useRef(false);
  const lastUpdateTime = useRef(0);
  
  // Timer refs for cleanup to prevent memory leaks
  const anchorUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const dragUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const optimizeTimer = useRef<NodeJS.Timeout | null>(null);
  const layoutQualityTimer = useRef<NodeJS.Timeout | null>(null);
  const fetchFitViewTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectionAttemptsRef = useRef(0);
  const filterFitViewTimer = useRef<NodeJS.Timeout | null>(null);
  const layoutAnchorTimer = useRef<NodeJS.Timeout | null>(null);
  const layoutFitViewTimer = useRef<NodeJS.Timeout | null>(null);

  // Standard edge change handler
  const onEdgesChange = useCallback((changes: any[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node clicks for highlighting connected nodes
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
  }, [selectedNodeId]);

  // Handle background clicks to clear selection
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Identify leaf nodes (optimized from O(n²) to O(n))
  const identifyLeafNodes = useCallback((nodes: AX25Node[], edges: AX25Edge[]) => {
    // Build adjacency count map in O(edges) time
    const connectionCounts = new Map<string, number>();
    const targetNodes = new Set<string>();
    
    nodes.forEach(node => connectionCounts.set(node.id, 0));
    
    edges.forEach(edge => {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
      targetNodes.add(edge.target);
    });
    
    // Filter in O(nodes) time
    return nodes.filter(node => {
      const count = connectionCounts.get(node.id) || 0;
      return count <= 1 || !targetNodes.has(node.id);
    });
  }, []);

  // Calculate optimal anchor points dynamically based on current node positions
  const calculateDynamicAnchorPoints = useCallback((sourceId: string, targetId: string, currentNodes: Node[]) => {
    const sourceNode = currentNodes.find(n => n.id === sourceId);
    const targetNode = currentNodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      return { sourceHandle: undefined, targetHandle: undefined };
    }
    
    const sourcePos = sourceNode.position;
    const targetPos = targetNode.position;
    
    // Get node dimensions (approximate from our styling)
    const getNodeDimensions = (node: Node) => {
      const nodeData = allNodes.find(n => n.id === node.id);
      if (!nodeData) return { width: 120, height: 60 };
      
      const isHearable = nodeData.is_hearable;
      const isLeaf = identifyLeafNodes(allNodes, allEdges).some(leaf => leaf.id === node.id);
      
      return {
        width: isHearable ? 140 : isLeaf ? 100 : 120,
        height: isHearable ? 70 : isLeaf ? 50 : 60
      };
    };
    
    const sourceDim = getNodeDimensions(sourceNode);
    const targetDim = getNodeDimensions(targetNode);
    
    // Calculate center positions
    const sourceCenterX = sourcePos.x + sourceDim.width / 2;
    const sourceCenterY = sourcePos.y + sourceDim.height / 2;
    const targetCenterX = targetPos.x + targetDim.width / 2;
    const targetCenterY = targetPos.y + targetDim.height / 2;
    
    // Enhanced anchor point calculation with better positioning
    const calculateAnchorPositions = (nodePos: {x: number, y: number}, dimensions: {width: number, height: number}, centerX: number, centerY: number) => {
      return {
        top: { 
          x: centerX, 
          y: nodePos.y, 
          handle: 'top',
          normal: { x: 0, y: -1 } // pointing up
        },
        bottom: { 
          x: centerX, 
          y: nodePos.y + dimensions.height, 
          handle: 'bottom',
          normal: { x: 0, y: 1 } // pointing down
        },
        left: { 
          x: nodePos.x, 
          y: centerY, 
          handle: 'left',
          normal: { x: -1, y: 0 } // pointing left
        },
        right: { 
          x: nodePos.x + dimensions.width, 
          y: centerY, 
          handle: 'right',
          normal: { x: 1, y: 0 } // pointing right
        }
      };
    };
    
    const sourceAnchors = calculateAnchorPositions(sourcePos, sourceDim, sourceCenterX, sourceCenterY);
    const targetAnchors = calculateAnchorPositions(targetPos, targetDim, targetCenterX, targetCenterY);
    
    // Smart anchor selection: prefer anchors that face each other
    let bestCombination = { distance: Infinity, sourceHandle: 'top', targetHandle: 'top' };
    
    Object.values(sourceAnchors).forEach(sourceAnchor => {
      Object.values(targetAnchors).forEach(targetAnchor => {
        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(targetAnchor.x - sourceAnchor.x, 2) + 
          Math.pow(targetAnchor.y - sourceAnchor.y, 2)
        );
        
        // Calculate if anchors face each other (normals point towards each other)
        const connectionVector = {
          x: targetAnchor.x - sourceAnchor.x,
          y: targetAnchor.y - sourceAnchor.y
        };
        const connectionLength = Math.sqrt(connectionVector.x * connectionVector.x + connectionVector.y * connectionVector.y);
        
        if (connectionLength > 0) {
          const normalizedConnection = {
            x: connectionVector.x / connectionLength,
            y: connectionVector.y / connectionLength
          };
          
          // Check if source anchor normal aligns with connection direction
          const sourceDot = sourceAnchor.normal.x * normalizedConnection.x + sourceAnchor.normal.y * normalizedConnection.y;
          // Check if target anchor normal aligns with reverse connection direction  
          const targetDot = targetAnchor.normal.x * (-normalizedConnection.x) + targetAnchor.normal.y * (-normalizedConnection.y);
          
          // Bonus for anchors that face each other
          const facingBonus = (sourceDot > 0.7 && targetDot > 0.7) ? 0.8 : 1.0;
          // Penalty for anchors that face away from connection
          const facingPenalty = (sourceDot < -0.3 || targetDot < -0.3) ? 1.3 : 1.0;
          
          const adjustedDistance = distance * facingBonus * facingPenalty;
          
          if (adjustedDistance < bestCombination.distance) {
            bestCombination = {
              distance: adjustedDistance,
              sourceHandle: sourceAnchor.handle,
              targetHandle: targetAnchor.handle
            };
          }
        }
      });
    });
    
    // Additional optimization: avoid connections that would intersect with other nodes
    // Check if the best connection line intersects with any other nodes
    const checkNodeIntersection = (line: {start: {x: number, y: number}, end: {x: number, y: number}}) => {
      return currentNodes.some(node => {
        if (node.id === sourceId || node.id === targetId) return false;
        
        const nodeDim = getNodeDimensions(node);
        const nodeRect = {
          left: node.position.x,
          right: node.position.x + nodeDim.width,
          top: node.position.y,
          bottom: node.position.y + nodeDim.height
        };
        
        // Simple line-rectangle intersection check
        return lineIntersectsRect(line.start, line.end, nodeRect);
      });
    };
    
    // Helper function for line-rectangle intersection
    const lineIntersectsRect = (lineStart: {x: number, y: number}, lineEnd: {x: number, y: number}, rect: {left: number, right: number, top: number, bottom: number}) => {
      // Check if line intersects any of the four rectangle edges
      const intersectsHorizontal = (y: number) => {
        if (lineStart.y === lineEnd.y) return Math.abs(lineStart.y - y) < 1;
        const t = (y - lineStart.y) / (lineEnd.y - lineStart.y);
        if (t < 0 || t > 1) return false;
        const x = lineStart.x + t * (lineEnd.x - lineStart.x);
        return x >= rect.left && x <= rect.right;
      };
      
      const intersectsVertical = (x: number) => {
        if (lineStart.x === lineEnd.x) return Math.abs(lineStart.x - x) < 1;
        const t = (x - lineStart.x) / (lineEnd.x - lineStart.x);
        if (t < 0 || t > 1) return false;
        const y = lineStart.y + t * (lineEnd.y - lineStart.y);
        return y >= rect.top && y <= rect.bottom;
      };
      
      return intersectsHorizontal(rect.top) || intersectsHorizontal(rect.bottom) || 
             intersectsVertical(rect.left) || intersectsVertical(rect.right);
    };
    
    // Verify the best connection doesn't intersect other nodes
    const sourceAnchorPos = sourceAnchors[bestCombination.sourceHandle as keyof typeof sourceAnchors];
    const targetAnchorPos = targetAnchors[bestCombination.targetHandle as keyof typeof targetAnchors];
    
    if (checkNodeIntersection({ start: sourceAnchorPos, end: targetAnchorPos })) {
      // If intersection detected, try alternative combinations
      const alternatives = Object.values(sourceAnchors).flatMap(sAnchor =>
        Object.values(targetAnchors).map(tAnchor => ({
          sourceHandle: sAnchor.handle,
          targetHandle: tAnchor.handle,
          distance: Math.sqrt(Math.pow(tAnchor.x - sAnchor.x, 2) + Math.pow(tAnchor.y - sAnchor.y, 2)),
          sourcePos: sAnchor,
          targetPos: tAnchor
        }))
      ).sort((a, b) => a.distance - b.distance);
      
      // Find first alternative that doesn't intersect
      for (const alt of alternatives) {
        if (!checkNodeIntersection({ start: alt.sourcePos, end: alt.targetPos })) {
          bestCombination.sourceHandle = alt.sourceHandle;
          bestCombination.targetHandle = alt.targetHandle;
          break;
        }
      }
    }
    
    console.log(`Calculating anchor points for ${sourceId} -> ${targetId}`);
    console.log('Best combination:', bestCombination);
    
    return {
      sourceHandle: bestCombination.sourceHandle,
      targetHandle: bestCombination.targetHandle
    };
  }, [allNodes, allEdges, identifyLeafNodes]);

  // Update edge anchor points when nodes move
  const updateEdgeAnchors = useCallback((currentNodes: Node[]) => {
    const now = Date.now();
    
    console.log('updateEdgeAnchors called with', currentNodes.length, 'nodes and', allEdges.length, 'edges');
    
    // Prevent updates if:
    // - No edges to update
    // - Currently selecting nodes  
    // - Too soon since last update (very short debounce for responsiveness)
    const noEdges = allEdges.length === 0;
    const selecting = isSelectingNode.current;
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    const tooSoon = timeSinceLastUpdate < 25; // Very short debounce for responsiveness
    
    if (noEdges || selecting || tooSoon) {
      console.log('updateEdgeAnchors skipped:', {
        noEdges,
        selecting,
        tooSoon,
        timeSinceLastUpdate,
        lastUpdateTime: lastUpdateTime.current,
        now
      });
      return;
    }
    
    console.log('updateEdgeAnchors proceeding with update');
    lastUpdateTime.current = now;
    
    setEdges(currentEdges => 
      currentEdges.map(edge => {
        const { sourceHandle, targetHandle } = calculateDynamicAnchorPoints(
          edge.source, 
          edge.target, 
          currentNodes
        );
        
        // Only update if the handles actually changed
        if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
          console.log(`📍 Updating edge ${edge.source} -> ${edge.target}: ${edge.sourceHandle}->${sourceHandle}, ${edge.targetHandle}->${targetHandle}`);
          return {
            ...edge,
            sourceHandle,
            targetHandle
          };
        }
        return edge;
      })
    );
    
    // Clear previous timer to avoid memory leaks
    if (anchorUpdateTimer.current) {
      clearTimeout(anchorUpdateTimer.current);
      anchorUpdateTimer.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculateDynamicAnchorPoints]);

  // Custom node change handler that updates anchor points only when user manually drags
  const onNodesChange = useCallback((changes: any[]) => {
    console.log('onNodesChange called with changes:', changes);
    
    // Apply the standard node changes
    setNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      
      // Detect different types of position changes
      const hasDragInProgress = changes.some(change => 
        change.type === 'position' && 
        change.dragging === true && 
        change.position &&
        !isSelectingNode.current
      );
      
      const hasDragCompleted = changes.some(change => 
        change.type === 'position' && 
        change.dragging === false && 
        change.position &&
        !isSelectingNode.current
      );
      
      console.log('Drag detection:', { hasDragInProgress, hasDragCompleted, edgeCount: allEdges.length });
      
      // For real-time updates during dragging (more responsive)
      if (hasDragInProgress && allEdges.length > 0) {
        console.log('Scheduling real-time anchor update during drag');
        // Clear any pending updates
        if (dragUpdateTimer.current) {
          clearTimeout(dragUpdateTimer.current);
        }
        // Very short delay for real-time updates during drag
        dragUpdateTimer.current = setTimeout(() => {
          console.log('Executing real-time anchor update');
          updateEdgeAnchors(updatedNodes);
          dragUpdateTimer.current = null;
        }, 50);
      }
      // For final update when drag completes (more thorough)
      else if (hasDragCompleted && allEdges.length > 0) {
        console.log('Scheduling final anchor update after drag completion');
        // Clear any pending real-time updates
        if (dragUpdateTimer.current) {
          clearTimeout(dragUpdateTimer.current);
        }
        // Slightly longer delay for final comprehensive update
        dragUpdateTimer.current = setTimeout(() => {
          console.log('Executing final anchor update');
          updateEdgeAnchors(updatedNodes);
          dragUpdateTimer.current = null;
        }, 100);
      }
      
      return updatedNodes;
    });
  }, [allEdges.length, updateEdgeAnchors, setNodes]);

  // Convert topology data to React Flow format
  const convertToReactFlow = useCallback((data: TopologyData, preservePositions: boolean = false) => {
    const leafNodes = identifyLeafNodes(data.nodes, data.edges);
    const leafNodeIds = new Set(leafNodes.map(node => node.id));
    
    // Always use all nodes for layout calculation, but hide leaf nodes if needed
    const allNodesForLayout = data.nodes;
    const allEdgesForLayout = data.edges;
    
    // Get existing positions if preserving them
    const existingPositions: Record<string, {x: number, y: number}> = {};
    if (preservePositions) {
      nodes.forEach(node => {
        existingPositions[node.id] = { x: node.position.x, y: node.position.y };
      });
    }
    
    // Calculate positions with selected algorithm using all nodes for consistent layout
    const positions = layoutAlgorithm === 'fruchterman'
      ? calculateNodePositions(allNodesForLayout, allEdgesForLayout, 1400, 1000)
      : layoutAlgorithm === 'sfdp'
        ? calculateSFDPPositions(allNodesForLayout, allEdgesForLayout, 1400, 1000)
        : calculateStraightLinePositions(allNodesForLayout, allEdgesForLayout, 1400, 1000);
    
    // Create nodes with visibility that will be managed separately
    const flowNodes: Node[] = allNodesForLayout.map((node) => {
      // Use existing position if preserving and available, otherwise use calculated position
      const position = (preservePositions && existingPositions[node.id]) 
        ? existingPositions[node.id]
        : positions.get(node.id) || { x: 400, y: 300 };
      const isLeaf = leafNodeIds.has(node.id);
      
      return {
        id: node.id,
        type: 'ax25Node',
        position,
        hidden: false, // Initial visibility - will be managed by separate effect
        data: {
          label: node.label,
          is_hearable: node.is_hearable,
          packet_count: node.packet_count,
          type: node.type,
          // Store node metadata for selection handling
          nodeData: node,
          isLeaf: isLeaf
        }
      };
    });

    // Apply edge bundling for cleaner visual organization
    const bundledAllEdges = bundleEdges(allEdgesForLayout, positions);
    
    // Create edges with dynamic routing (selection styling handled separately)
    const flowEdges: Edge[] = bundledAllEdges.map((edge) => {
      // Calculate initial anchor points for new edges
      const { sourceHandle, targetHandle } = allNodesForLayout.length > 0 ? 
        (() => {
          // Convert to React Flow nodes for anchor calculation
          const tempNodes = allNodesForLayout.map(node => {
            const position = positions.get(node.id) || { x: 400, y: 300 };
            return {
              id: node.id,
              position,
              data: { nodeData: node }
            };
          });
          return calculateDynamicAnchorPoints(edge.source, edge.target, tempNodes);
        })() : 
        { sourceHandle: undefined, targetHandle: undefined };
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle, // Use calculated anchor points
        targetHandle, // Use calculated anchor points
        label: edge.count.toString(),
        type: layoutAlgorithm === 'straight' ? 'straight' : layoutAlgorithm === 'sfdp' ? 'bezier' : 'smoothstep',
        animated: edge.count > 20,
        data: {
          count: edge.count // Store for styling calculations
        },
        style: {
          stroke: edge.count > 50 ? '#dc2626' : edge.count > 20 ? '#ea580c' : '#6b7280',
          strokeWidth: Math.min(8, Math.max(1, edge.count / 3)),
          opacity: 1,
          transition: 'all 0.2s ease',
        },
        labelStyle: {
          fill: '#374151',
          fontWeight: 'bold',
          fontSize: '11px',
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '2px 4px',
          borderRadius: '3px',
        },
        labelBgStyle: {
          fill: 'rgba(255, 255, 255, 0.8)',
          fillOpacity: 0.8,
        },
      };
    });

    
    // Calculate and store layout quality after positioning
    const finalQuality = assessLayoutQuality(allNodesForLayout, allEdgesForLayout, positions);
    const grade = finalQuality.totalScore < 50 ? 'A' : 
                 finalQuality.totalScore < 100 ? 'B' : 
                 finalQuality.totalScore < 200 ? 'C' : 'D';
    
    // Clear previous timer and update layout quality without causing dependency issues
    if (layoutQualityTimer.current) {
      clearTimeout(layoutQualityTimer.current);
    }
    layoutQualityTimer.current = setTimeout(() => {
      setLayoutQuality({
        ...finalQuality,
        grade
      });
      layoutQualityTimer.current = null;
    }, 0);

    return { nodes: flowNodes, edges: flowEdges };
  }, [identifyLeafNodes, layoutAlgorithm]); // Removed showLeafNodes since visibility is handled separately

  // Memoize expensive calculations
  const hearableNodeIds = useMemo(() => 
    allNodes.filter(n => n.is_hearable).map(n => n.id), 
    [allNodes]
  );
  
  const leafNodes = useMemo(() => 
    identifyLeafNodes(allNodes, allEdges), 
    [allNodes, allEdges, identifyLeafNodes]
  );
  
  const leafNodeCount = leafNodes.length;

  // Update selection styling when selectedNodeId changes
  useEffect(() => {
    // Only prevent updates during anchor calculations, not during node selection
    if (isUpdatingAnchors.current) {
      return;
    }
    
    // Apply selection styling directly without separate function
    if (!selectedNodeId) {
      // Clear all selection styling
      setNodes(currentNodes => 
        currentNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: 1
          },
          data: {
            ...node.data,
            isConnected: false,
            isDimmed: false,
            selectedNodeId: null,
            isSelected: false
          }
        }))
      );
      
      setEdges(currentEdges => 
        currentEdges.map(edge => {
          const originalStroke = edge.data?.count > 50 ? '#dc2626' : edge.data?.count > 20 ? '#ea580c' : '#6b7280';
          const originalStrokeWidth = Math.min(8, Math.max(1, (edge.data?.count || 1) / 3));
          
          return {
            ...edge,
            style: {
              ...edge.style,
              opacity: 1,
              stroke: originalStroke,
              strokeWidth: originalStrokeWidth
            },
            animated: edge.data?.count > 20
          };
        })
      );
    } else {
      // Apply selection highlighting
      setEdges(currentEdges => {
        // Get connected edges and nodes from current state
        const connectedEdgeIds = new Set();
        const connectedNodeIds = new Set();
        
        currentEdges.forEach(edge => {
          if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
            connectedEdgeIds.add(edge.id);
            if (edge.source === selectedNodeId) connectedNodeIds.add(edge.target);
            if (edge.target === selectedNodeId) connectedNodeIds.add(edge.source);
          }
        });

        // Update node styling using the connection info
        setNodes(currentNodes => 
          currentNodes.map(node => {
            const isSelected = node.id === selectedNodeId;
            const isConnected = connectedNodeIds.has(node.id);
            const isDimmed = !isSelected && !isConnected;

            return {
              ...node,
              data: {
                ...node.data,
                isConnected: isConnected,
                isDimmed: isDimmed,
                selectedNodeId: selectedNodeId, // Pass the selected node ID
                isSelected: isSelected // Explicitly pass selection state
              }
            };
          })
        );

        // Update edge styling
        return currentEdges.map(edge => {
          const isConnected = connectedEdgeIds.has(edge.id);
          const isDimmed = !isConnected;

          const originalStroke = edge.data?.count > 50 ? '#dc2626' : edge.data?.count > 20 ? '#ea580c' : '#6b7280';
          const originalStrokeWidth = Math.min(8, Math.max(1, (edge.data?.count || 1) / 3));

          return {
            ...edge,
            style: {
              ...edge.style,
              opacity: isDimmed ? 0.2 : 1,
              stroke: isConnected ? '#16a34a' : originalStroke,
              strokeWidth: isConnected 
                ? Math.min(10, Math.max(3, (edge.data?.count || 1) / 3))
                : originalStrokeWidth
            },
            animated: isConnected && edge.data?.count > 20
          };
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  // Fetch topology data from API
  const fetchTopology = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/topology');
      if (response.ok) {
        const data: TopologyData = await response.json();
        setAllNodes(data.nodes);
        setAllEdges(data.edges);
        setStats({
          ...data.stats,
          last_updated: data.stats.last_updated || new Date().toISOString()
        });
        
        // Note: convertToReactFlow will be called by the filter useEffect
        // No need to call it here to avoid double processing
        
        // Clear previous timer and auto-fit the view after a delay
        if (fetchFitViewTimer.current) {
          clearTimeout(fetchFitViewTimer.current);
        }
        fetchFitViewTimer.current = setTimeout(() => {
          fitView({ padding: 50 });
          fetchFitViewTimer.current = null;
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching topology:', error);
      
      // Use mock data for testing when backend is not available
      console.log('🧪 Using mock data for anchor point testing');
      const mockData: TopologyData = {
        nodes: [
          { id: 'NODE1', label: 'Node 1', packet_count: 100, is_hearable: true, type: 'hearable' },
          { id: 'NODE2', label: 'Node 2', packet_count: 50, is_hearable: false, type: 'relay' },
          { id: 'NODE3', label: 'Node 3', packet_count: 75, is_hearable: false, type: 'relay' },
          { id: 'NODE4', label: 'Node 4', packet_count: 25, is_hearable: false, type: 'relay' }
        ],
        edges: [
          { id: 'e1', source: 'NODE1', target: 'NODE2', count: 10, label: 'Link 1' },
          { id: 'e2', source: 'NODE2', target: 'NODE3', count: 15, label: 'Link 2' },
          { id: 'e3', source: 'NODE3', target: 'NODE4', count: 8, label: 'Link 3' },
          { id: 'e4', source: 'NODE1', target: 'NODE3', count: 12, label: 'Link 4' }
        ],
        hearable_nodes: ['NODE1'],
        stats: { 
          total_nodes: 4, 
          total_edges: 4, 
          hearable_count: 1,
          last_updated: new Date().toISOString()
        }
      };
      
      setAllNodes(mockData.nodes);
      setAllEdges(mockData.edges);
      setStats({
        ...mockData.stats,
        last_updated: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }, [fitView]);

  // Update visualization when filter changes (but only for significant changes)
  useEffect(() => {
    if (allNodes.length > 0 && !isSelectingNode.current && !isUpdatingAnchors.current) {
      const { nodes: flowNodes, edges: flowEdges } = convertToReactFlow({
        nodes: allNodes,
        edges: allEdges,
        hearable_nodes: hearableNodeIds,
        stats
      }, true); // Preserve existing positions when refreshing data
      setNodes(flowNodes);
      setEdges(flowEdges);
      // Clear previous timer and fit view
      if (filterFitViewTimer.current) {
        clearTimeout(filterFitViewTimer.current);
      }
      filterFitViewTimer.current = setTimeout(() => {
        fitView({ padding: 50 });
        filterFitViewTimer.current = null;
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNodes, allEdges, stats, convertToReactFlow, fitView, hearableNodeIds]); // Removed showLeafNodes to prevent re-layout

  // Separate effect to toggle leaf node visibility without re-layout
  useEffect(() => {
    if (nodes.length > 0) {
      const leafNodeIds = new Set(identifyLeafNodes(allNodes, allEdges).map(node => node.id));
      
      setNodes(currentNodes => 
        currentNodes.map(node => {
          const isLeaf = leafNodeIds.has(node.id);
          return {
            ...node,
            hidden: !showLeafNodes && isLeaf
          };
        })
      );
    }
  }, [showLeafNodes, nodes.length]); // Only depend on showLeafNodes and whether we have nodes

  // WebSocket connection effect - separate from other dependencies
  useEffect(() => {
    let fetchDebounceTimer: NodeJS.Timeout;
    let isConnecting = false;
    
    const connectWebSocket = () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnecting) {
        console.log('🔌 Connection already in progress, skipping...');
        return;
      }
      
      // Check if we've exceeded max attempts
      if (reconnectionAttemptsRef.current >= 3) {
        console.log('🔌 WebSocket: Max reconnection attempts reached. Backend may not be running.');
        return;
      }

      isConnecting = true;
      
      // Close existing WebSocket if any
      if (ws) {
        ws.close();
        setWs(null);
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:8000/ws`;
      
      console.log(`🔌 WebSocket: Connecting to ${wsUrl} (attempt ${reconnectionAttemptsRef.current + 1}/3)`);
      
      try {
        const websocket = new WebSocket(wsUrl);
        
        websocket.onopen = () => {
          isConnecting = false;
          setIsConnected(true);
          reconnectionAttemptsRef.current = 0; // Reset on successful connection
          console.log('✅ WebSocket connected successfully');
          
          // Clear any pending reconnection timers
          if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
          }
        };
        
        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'topology_update') {
              // Debounce fetch requests to prevent flooding
              clearTimeout(fetchDebounceTimer);
              fetchDebounceTimer = setTimeout(() => {
                fetchTopology();
              }, 1000);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        websocket.onclose = (event) => {
          isConnecting = false;
          setIsConnected(false);
          setWs(null);
          
          // Only retry if this wasn't a manual close
          if (event.code !== 1000 && reconnectionAttemptsRef.current < 3) {
            reconnectionAttemptsRef.current++;
            console.log(`🔌 WebSocket disconnected (code: ${event.code}). Retrying in 3s... (${reconnectionAttemptsRef.current}/3)`);
            
            if (reconnectTimer.current) {
              clearTimeout(reconnectTimer.current);
            }
            
            reconnectTimer.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          } else if (event.code === 1000) {
            console.log('🔌 WebSocket closed normally');
          } else {
            console.log('🔌 WebSocket: Max reconnection attempts reached');
          }
        };
        
        websocket.onerror = (error) => {
          isConnecting = false;
          console.error('🔌 WebSocket error:', error);
        };
        
        setWs(websocket);
        
      } catch (error) {
        isConnecting = false;
        console.error('🔌 Failed to create WebSocket:', error);
        reconnectionAttemptsRef.current++;
        
        if (reconnectionAttemptsRef.current < 3) {
          setTimeout(connectWebSocket, 3000);
        }
      }
    };

    // Start the connection
    connectWebSocket();

    // Cleanup function
    return () => {
      clearTimeout(fetchDebounceTimer);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (ws) {
        ws.close(1000); // Normal closure
        setWs(null);
      }
      isConnecting = false;
    };
  }, [fetchTopology]); // Remove 'ws' from dependencies to prevent loops

  // Initial data fetch
  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Cleanup effect to prevent timer leaks
  useEffect(() => {
    return () => {
      // Clear all timers on unmount to prevent memory leaks
      [anchorUpdateTimer, dragUpdateTimer, optimizeTimer, layoutQualityTimer, 
       fetchFitViewTimer, filterFitViewTimer, layoutAnchorTimer, layoutFitViewTimer, 
       reconnectTimer].forEach(timer => {
        if (timer.current) {
          clearTimeout(timer.current);
        }
      });
    };
  }, []);

  const refreshData = () => {
    fetchTopology();
  };

  const toggleLeafNodes = () => {
    setShowLeafNodes(!showLeafNodes);
    // Note: No need to set isSelectingNode since we want immediate re-render
  };

  const handleLayoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLayout = event.target.value as 'fruchterman' | 'straight' | 'sfdp';
    isSelectingNode.current = true; // Prevent anchor updates during this operation
    setLayoutAlgorithm(newLayout);
    // Clear selection when switching algorithms
    setSelectedNodeId(null);
    
    setTimeout(() => {
      isSelectingNode.current = false;
    }, 300);
  };

  const reLayoutGraph = () => {
    if (allNodes.length > 0) {
      isSelectingNode.current = true; // Prevent interference during layout
      
      // Force a new layout calculation
      const { nodes: flowNodes, edges: flowEdges } = convertToReactFlow({
        nodes: allNodes,
        edges: allEdges,
        hearable_nodes: hearableNodeIds,
        stats
      });
      setNodes(flowNodes);
      setEdges(flowEdges);
      
      // Clear previous timers and update anchor points after layout is complete
      if (layoutAnchorTimer.current) {
        clearTimeout(layoutAnchorTimer.current);
      }
      layoutAnchorTimer.current = setTimeout(() => {
        isSelectingNode.current = false;
        updateEdgeAnchors(flowNodes);
        layoutAnchorTimer.current = null;
      }, 200);
      
      if (layoutFitViewTimer.current) {
        clearTimeout(layoutFitViewTimer.current);
      }
      layoutFitViewTimer.current = setTimeout(() => {
        fitView({ padding: 50 });
        layoutFitViewTimer.current = null;
      }, 400);
    }
  };

  const optimizeConnections = () => {
    if (nodes.length > 0 && edges.length > 0) {
      console.log('Optimizing connections...'); // Debug log
      setIsOptimizing(true);
      
      // Reset all timing controls to force immediate update
      isUpdatingAnchors.current = false;
      isSelectingNode.current = false;
      lastUpdateTime.current = 0;
      
      // Force immediate edge anchor optimization
      setEdges(currentEdges => {
        console.log('Recalculating anchor points for', currentEdges.length, 'edges'); // Debug log
        return currentEdges.map(edge => {
          const { sourceHandle, targetHandle } = calculateDynamicAnchorPoints(
            edge.source, 
            edge.target, 
            nodes
          );
          
          return {
            ...edge,
            sourceHandle,
            targetHandle
          };
        });
      });
      
      // Clear previous timer and reset optimization state after a short delay
      if (optimizeTimer.current) {
        clearTimeout(optimizeTimer.current);
      }
      optimizeTimer.current = setTimeout(() => {
        setIsOptimizing(false);
        optimizeTimer.current = null;
      }, 500);
    } else {
      console.log('Cannot optimize: no nodes or edges available'); // Debug log
    }
  };

  const saveLayoutPositions = async () => {
    setIsSaving(true);
    try {
      // Collect current node positions
      const positions: Record<string, {x: number, y: number}> = {};
      nodes.forEach(node => {
        positions[node.id] = {
          x: node.position.x,
          y: node.position.y
        };
      });

      const response = await fetch('http://localhost:8000/layout/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          layout_algorithm: layoutAlgorithm,
          positions: positions
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Layout saved:', result);
        // Could add a toast notification here
      } else {
        const error = await response.json();
        console.error('❌ Failed to save layout:', error);
      }
    } catch (error) {
      console.error('❌ Error saving layout:', error);
    } finally {
      // Keep the success state visible for a moment
      setTimeout(() => {
        setIsSaving(false);
      }, 1000);
    }
  };

  const restoreLayoutPositions = async () => {
    setIsRestoring(true);
    try {
      const response = await fetch(`http://localhost:8000/layout/restore/${layoutAlgorithm}`);
      
      if (response.ok) {
        const result = await response.json();
        const savedPositions = result.positions;
        
        console.log('✅ Layout restored:', result);
        
        // Use the same anchor update logic as when dragging nodes
        setTimeout(() => {
          // Get the updated nodes after position changes
          setNodes(currentNodes => {
            const updatedNodes = currentNodes.map(node => {
              const savedPosition = savedPositions[node.id];
              return savedPosition ? {
                ...node,
                position: {
                  x: savedPosition.x,
                  y: savedPosition.y
                }
              } : node;
            });
            
            // Update anchors using the same function as node dragging
            updateEdgeAnchors(updatedNodes);
            
            return updatedNodes;
          });
        }, 100);
        
      } else if (response.status === 404) {
        console.log(`ℹ️ No saved layout found for ${layoutAlgorithm} algorithm`);
        // Could show a toast message to user
      } else {
        const error = await response.json();
        console.error('❌ Failed to restore layout:', error);
      }
    } catch (error) {
      console.error('❌ Error restoring layout:', error);
    } finally {
      // Keep the success state visible for a moment
      setTimeout(() => {
        setIsRestoring(false);
      }, 1000);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Header Controls */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            AX25 Network Topology
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#666'
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#10b981' : '#ef4444'
            }}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Statistics */}
          <div style={{ fontSize: '14px', color: '#666' }}>
            <span style={{ fontWeight: 'bold', color: '#ff6600' }}>
              {stats.hearable_count} hearable
            </span>
            {' • '}
            <span>{stats.total_nodes} total nodes</span>
            {' • '}
            <span>{stats.total_edges} connections</span>
          </div>

          {/* Layout Quality Indicator */}
          <div style={{ 
            fontSize: '12px', 
            padding: '4px 8px',
            backgroundColor: layoutQuality.grade === 'A' ? '#10b981' : 
                           layoutQuality.grade === 'B' ? '#f59e0b' : 
                           layoutQuality.grade === 'C' ? '#f97316' : '#ef4444',
            color: 'white',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            Layout: {layoutQuality.grade} 
            <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.8 }}>
              ({layoutQuality.crossings} crossings)
            </span>
          </div>

          {/* Layout Algorithm Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={16} color="#374151" />
            <label style={{ 
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Layout:
            </label>
            <select
              value={layoutAlgorithm}
              onChange={handleLayoutChange}
              style={{
                padding: '8px 12px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
                minWidth: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <option value="fruchterman">Fruchterman-Reingold</option>
              <option value="sfdp">SFDP (GraphViz)</option>
              <option value="straight">Straight Line</option>
            </select>
          </div>

          {/* Toggle Leaf Nodes */}
          <button
            onClick={toggleLeafNodes}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: showLeafNodes ? '#3b82f6' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {showLeafNodes ? <Eye size={16} /> : <EyeOff size={16} />}
            Leaf Nodes ({leafNodeCount})
          </button>

          {/* Re-layout Button */}
          <button
            onClick={reLayoutGraph}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Shuffle size={16} />
            Re-layout
          </button>

          {/* Save Layout Button */}
          <button
            onClick={saveLayoutPositions}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: isSaving ? '#10b981' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSaving ? 'default' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transform: isSaving ? 'scale(0.98)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            <Save size={16} style={{
              transform: isSaving ? 'rotate(360deg)' : 'rotate(0deg)',
              transition: 'transform 0.6s ease'
            }} />
            {isSaving ? 'Saving...' : 'Save Layout'}
          </button>

          {/* Restore Layout Button */}
          <button
            onClick={restoreLayoutPositions}
            disabled={isRestoring}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: isRestoring ? '#3b82f6' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isRestoring ? 'default' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transform: isRestoring ? 'scale(0.98)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={16} style={{
              transform: isRestoring ? 'translateY(2px)' : 'translateY(0px)',
              transition: 'transform 0.3s ease'
            }} />
            {isRestoring ? 'Restoring...' : 'Restore Layout'}
          </button>

          {/* Optimize Connections Button */}
          <button
            onClick={optimizeConnections}
            disabled={isOptimizing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: isOptimizing ? '#d97706' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isOptimizing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isOptimizing ? 0.7 : 1
            }}
          >
            <Target size={16} />
            {isOptimizing ? 'Optimizing...' : 'Optimize'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshData}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} style={{
              animation: isLoading ? 'spin 1s linear infinite' : 'none'
            }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: '10px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        fontSize: '12px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Legend</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px',
              height: '12px',
              background: '#ffd700',
              border: '2px solid #ff6600',
              borderRadius: '4px'
            }}></div>
            <span>Hearable nodes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px',
              height: '12px',
              background: '#f0f9ff',
              border: '2px solid #3b82f6',
              borderRadius: '4px'
            }}></div>
            <span>Repeater nodes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px',
              height: '12px',
              background: '#dbeafe',
              border: '2px solid #ea580c',
              borderRadius: '4px'
            }}></div>
            <span>Leaf nodes</span>
          </div>
          {selectedNodeId && (
            <>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              <div style={{ fontWeight: 'bold', color: '#dc2626' }}>
                Selected: {allNodes.find(n => n.id === selectedNodeId)?.label || selectedNodeId}
              </div>
              <div style={{ fontSize: '10px', color: '#666' }}>
                Click node again to deselect
              </div>
            </>
          )}
        </div>
      </div>

      {/* React Flow */}
      {useMemo(() => (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable={true}
          selectNodesOnDrag={false}
          elementsSelectable={false}
          multiSelectionKeyCode={null}
          selectionKeyCode={null}
          fitView
          style={{ background: '#f8fafc' }}
        >
          <Controls />
          <Background gap={20} size={1} />
          <MiniMap style={{
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid #ccc'
          }} />
        </ReactFlow>
      ), [nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, onPaneClick])}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            padding: '20px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <RefreshCw size={20} style={{
              animation: 'spin 1s linear infinite'
            }} />
            <span>Loading network topology...</span>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Main component wrapped with ReactFlowProvider
const TopologyViewer: React.FC = () => {
  return (
    <ReactFlowProvider>
      <TopologyViewerContent />
    </ReactFlowProvider>
  );
};

export default TopologyViewer;