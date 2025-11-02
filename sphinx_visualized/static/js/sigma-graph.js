// Sigma.js Graph Visualization
// This script loads GraphSON data and renders it using sigma.js

import forceAtlas2 from 'https://cdn.skypack.dev/graphology-layout-forceatlas2';

window.addEventListener('DOMContentLoaded', async () => {
  // Fetch the GraphSON data
  let graphsonData;
  try {
    const response = await fetch('../graphson.json');
    graphsonData = await response.json();
  } catch (error) {
    console.error('Error loading GraphSON data:', error);
    return;
  }

  const container = document.getElementById('graph-container');

  // Check if we have data
  if (!graphsonData.vertices || graphsonData.vertices.length === 0) {
    container.innerHTML = '<div style="padding: 50px; text-align: center;">No graph data available</div>';
    return;
  }

  // Create a new graphology graph
  const graph = new graphology.Graph();

  // Add nodes from GraphSON vertices with random initial positions
  graphsonData.vertices.forEach((vertex, index) => {
    graph.addNode(String(vertex.id), {
      label: vertex.properties.name,
      path: vertex.properties.path,
      size: 5,
      color: '#5A88B8',
      x: Math.random() * 100,
      y: Math.random() * 100
    });
  });

  // Add edges from GraphSON edges
  graphsonData.edges.forEach(edge => {
    try {
      graph.addEdge(String(edge.outV), String(edge.inV), {
        label: edge.label,
        strength: edge.properties.strength,
        reference_count: edge.properties.reference_count,
        size: 1,
        type: 'arrow'
      });
    } catch (e) {
      // Skip duplicate edges
      console.warn('Skipping duplicate edge:', edge);
    }
  });

  // Apply ForceAtlas2 layout
  const settings = forceAtlas2.inferSettings(graph);

  // Run the layout algorithm with settings optimized for spread
  forceAtlas2.assign(graph, {
    iterations: 200,
    settings: {
      ...settings,
      gravity: 0.05,
      scalingRatio: 50,
      slowDown: 1,
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      strongGravityMode: false,
      outboundAttractionDistribution: false,
      linLogMode: false
    }
  });

  // Create the sigma instance
  try {
    const renderer = new Sigma(graph, container, {
      renderEdgeLabels: false,
      defaultNodeColor: '#5A88B8',
      defaultEdgeColor: '#ccc',
      labelFont: 'Arial',
      labelSize: 12,
      labelWeight: 'normal',
      labelColor: { color: '#000' }
    });

    // State for tracking hover
    let hoveredNode = null;
    let hoveredNeighbors = new Set();

    // Handle node clicks to navigate to pages
    renderer.on('clickNode', ({ node }) => {
      const nodeData = graph.getNodeAttributes(node);
      if (nodeData.path) {
        window.location.href = nodeData.path;
      }
    });

    // Hover effect - highlight node, connected edges, and neighbor nodes
    renderer.on('enterNode', ({ node }) => {
      hoveredNode = node;
      hoveredNeighbors.clear();

      // Set all nodes and edges to reduced visibility first
      graph.forEachNode((n) => {
        if (n !== node) {
          graph.setNodeAttribute(n, 'color', '#E2E2E2');
          graph.setNodeAttribute(n, 'highlighted', false);
        }
      });

      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', '#E2E2E2');
        graph.setEdgeAttribute(edge, 'highlighted', false);
      });

      // Highlight the hovered node
      graph.setNodeAttribute(node, 'color', '#E96463');
      graph.setNodeAttribute(node, 'highlighted', true);

      // Highlight connected edges and neighbor nodes
      graph.forEachEdge(node, (edge, attributes, source, target) => {
        graph.setEdgeAttribute(edge, 'color', '#5A88B8');
        graph.setEdgeAttribute(edge, 'highlighted', true);

        const neighbor = source === node ? target : source;
        hoveredNeighbors.add(neighbor);
        graph.setNodeAttribute(neighbor, 'color', '#24B086');
        graph.setNodeAttribute(neighbor, 'highlighted', true);
      });
    });

    renderer.on('leaveNode', () => {
      hoveredNode = null;
      hoveredNeighbors.clear();

      // Reset all nodes and edges to default state
      graph.forEachNode((node) => {
        graph.setNodeAttribute(node, 'color', '#5A88B8');
        graph.setNodeAttribute(node, 'highlighted', false);
      });

      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', '#ccc');
        graph.setEdgeAttribute(edge, 'highlighted', false);
      });
    });

    // Search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        const matches = nodeData.label.toLowerCase().includes(searchTerm);

        if (searchTerm === '') {
          graph.setNodeAttribute(node, 'color', '#5A88B8');
          graph.setNodeAttribute(node, 'size', 3);
        } else if (matches) {
          graph.setNodeAttribute(node, 'color', '#24B086');
          graph.setNodeAttribute(node, 'size', 5);
        } else {
          graph.setNodeAttribute(node, 'color', '#cccccc');
          graph.setNodeAttribute(node, 'size', 1.5);
        }
      });
    });

    // Reset zoom button
    document.getElementById('reset-zoom').addEventListener('click', () => {
      const camera = renderer.getCamera();
      camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 500 });
    });

    // Export GraphSON button
    document.getElementById('export-json').addEventListener('click', () => {
      const dataStr = JSON.stringify(graphsonData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sphinx-graph.json';
      link.click();
      URL.revokeObjectURL(url);
    });

    console.log('Sigma.js graph loaded successfully');
    console.log(`Nodes: ${graph.order}, Edges: ${graph.size}`);
  } catch (error) {
    console.error('Error creating Sigma renderer:', error);
    container.innerHTML = `<div style="padding: 50px; text-align: center;">
      <h3>Error loading visualization</h3>
      <p>${error.message}</p>
      <p>Please check the browser console for details.</p>
    </div>`;
  }
});
