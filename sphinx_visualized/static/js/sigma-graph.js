// Sigma.js Graph Visualization
// This script loads GraphSON data and renders it using sigma.js

import forceAtlas2 from 'https://cdn.skypack.dev/graphology-layout-forceatlas2';

// Default color palette inspired by sigmajs.org
const DEFAULT_COLORS = [
  '#331A00', '#663000', '#996136', '#CC9B7A',
  '#D9AF98', '#F2DACE', '#CCFDFF', '#99F8FF',
  '#66F0FF', '#33E4FF', '#00AACC', '#5A88B8',
  '#E96463', '#24B086', '#FF6B6B', '#4ECDC4',
  '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9'
];

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

  // Process cluster configuration
  const clusterConfig = graphsonData.clusters || [];
  const clusterColorMap = {};
  const clusterColors = {};

  // Assign colors to clusters
  clusterConfig.forEach((cluster, index) => {
    const color = cluster.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    clusterColors[cluster.name] = color;
    clusterColorMap[cluster.name] = {
      color: color,
      patterns: cluster.patterns || []
    };
  });

  // Define category colors (for node types, not clusters)
  const CATEGORY_COLORS = {
    'Internal Pages': '#5A88B8',
    'Intersphinx Pages': '#9B59B6'
  };

  // Create a new graphology graph
  const graph = new graphology.Graph();

  // Add nodes from GraphSON vertices with random initial positions
  graphsonData.vertices.forEach((vertex, index) => {
    const cluster = vertex.properties.cluster;
    const isIntersphinx = vertex.label === 'intersphinx' || vertex.properties.is_intersphinx;

    // Determine category based on node type
    const category = isIntersphinx ? 'Intersphinx Pages' : 'Internal Pages';

    // Use different colors for different node types
    let nodeColor;
    if (isIntersphinx) {
      nodeColor = CATEGORY_COLORS['Intersphinx Pages'];
    } else if (cluster && clusterColors[cluster]) {
      nodeColor = clusterColors[cluster];
    } else {
      nodeColor = CATEGORY_COLORS['Internal Pages'];
    }

    graph.addNode(String(vertex.id), {
      label: vertex.properties.name,
      path: vertex.properties.path,
      cluster: cluster,
      category: category,
      size: isIntersphinx ? 4 : 5, // Slightly smaller for intersphinx nodes
      color: nodeColor,
      originalColor: nodeColor,
      isExternal: vertex.properties.is_external,
      isIntersphinx: isIntersphinx,
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
        // Open external links in new tab, navigate internal links in current tab
        if (nodeData.isExternal) {
          window.open(nodeData.path, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = nodeData.path;
        }
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
        const nodeData = graph.getNodeAttributes(node);
        graph.setNodeAttribute(node, 'color', nodeData.originalColor);
        graph.setNodeAttribute(node, 'highlighted', false);
      });

      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', '#ccc');
        graph.setEdgeAttribute(edge, 'highlighted', false);
      });
    });

    // Category panel functionality (for node types)
    const categoryContainer = document.getElementById('category-panel');
    if (categoryContainer) {
      // Calculate nodes per category
      const nodesPerCategory = {};
      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        const category = nodeData.category || 'Internal Pages';
        nodesPerCategory[category] = (nodesPerCategory[category] || 0) + 1;
      });

      // Track which categories are visible
      const visibleCategories = {
        'Internal Pages': true,
        'Intersphinx Pages': true
      };

      const updateGraphByCategory = () => {
        graph.forEachNode((node) => {
          const nodeData = graph.getNodeAttributes(node);
          const category = nodeData.category || 'Internal Pages';

          if (visibleCategories[category]) {
            graph.setNodeAttribute(node, 'hidden', false);
          } else {
            graph.setNodeAttribute(node, 'hidden', true);
          }
        });
      };

      const renderCategoryPanel = () => {
        const categories = Object.keys(CATEGORY_COLORS);
        const visibleCount = categories.filter(c => visibleCategories[c]).length;

        // Calculate max nodes for progress bar scaling
        const maxNodesPerCategory = Math.max(...categories.map(c => nodesPerCategory[c] || 0));

        categoryContainer.innerHTML = `
          <h3 style="margin-top: 0; font-size: 1.3em; margin-bottom: 0.5em;">
            Categories
            ${visibleCount < categories.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${categories.length})</span>` : ''}
          </h3>
          <p style="color: #666; font-style: italic; font-size: 0.9em;">Click a category to show/hide node types from the network.</p>
          <p class="cluster-buttons">
            <button id="check-all-categories-btn" class="cluster-btn">☑ Check all</button>
            <button id="uncheck-all-categories-btn" class="cluster-btn">☐ Uncheck all</button>
          </p>
          <ul style="list-style: none; padding: 0; margin: 0;"></ul>
        `;

        const list = categoryContainer.querySelector('ul');

        categories.forEach((category, index) => {
          const color = CATEGORY_COLORS[category];
          const count = nodesPerCategory[category] || 0;
          const isChecked = visibleCategories[category];
          const barWidth = maxNodesPerCategory > 0 ? (100 * count) / maxNodesPerCategory : 0;

          const li = document.createElement('li');
          li.className = 'caption-row';
          li.title = `${count} node${count !== 1 ? 's' : ''}`;
          li.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} id="category-${index}" />
            <label for="category-${index}">
              <span class="circle" style="background-color: ${color}; border-color: ${color};"></span>
              <div class="node-label">
                <span>${category}</span>
                <div class="bar" style="width: ${barWidth}%;"></div>
              </div>
            </label>
          `;

          li.querySelector('input').addEventListener('change', (e) => {
            visibleCategories[category] = e.target.checked;
            updateGraphByCategory();
            renderCategoryPanel();
          });

          list.appendChild(li);
        });

        // Add button handlers
        document.getElementById('check-all-categories-btn').addEventListener('click', () => {
          categories.forEach(category => {
            visibleCategories[category] = true;
          });
          updateGraphByCategory();
          renderCategoryPanel();
        });

        document.getElementById('uncheck-all-categories-btn').addEventListener('click', () => {
          categories.forEach(category => {
            visibleCategories[category] = false;
          });
          updateGraphByCategory();
          renderCategoryPanel();
        });
      };

      renderCategoryPanel();
    }

    // Cluster legend functionality (similar to sigma.js demo)
    const legendContainer = document.getElementById('cluster-panel');

    // Calculate nodes per cluster
    const nodesPerCluster = {};
    let maxNodesPerCluster = 0;
    graph.forEachNode((node) => {
      const nodeData = graph.getNodeAttributes(node);
      const cluster = nodeData.cluster || 'uncategorized';
      nodesPerCluster[cluster] = (nodesPerCluster[cluster] || 0) + 1;
      maxNodesPerCluster = Math.max(maxNodesPerCluster, nodesPerCluster[cluster]);
    });

    if (clusterConfig.length > 0) {
      if (legendContainer) {
        // Track which clusters are visible
        const visibleClusters = {};
        clusterConfig.forEach(cluster => {
          visibleClusters[cluster.name] = true;
        });

        const updateGraph = () => {
          graph.forEachNode((node) => {
            const nodeData = graph.getNodeAttributes(node);
            const cluster = nodeData.cluster;

            if (!cluster || visibleClusters[cluster]) {
              graph.setNodeAttribute(node, 'color', nodeData.originalColor);
              graph.setNodeAttribute(node, 'hidden', false);
            } else {
              graph.setNodeAttribute(node, 'hidden', true);
            }
          });
        };

        const renderLegend = () => {
          const visibleCount = Object.values(visibleClusters).filter(v => v).length;

          legendContainer.innerHTML = `
            <h3 style="margin-top: 0; font-size: 1.3em; margin-bottom: 0.5em;">
              Clusters
              ${visibleCount < clusterConfig.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${clusterConfig.length})</span>` : ''}
            </h3>
            <p style="color: #666; font-style: italic; font-size: 0.9em;">Click a cluster to show/hide related pages from the network.</p>
            <p class="cluster-buttons">
              <button id="check-all-btn" class="cluster-btn">☑ Check all</button>
              <button id="uncheck-all-btn" class="cluster-btn">☐ Uncheck all</button>
            </p>
            <ul style="list-style: none; padding: 0; margin: 0;"></ul>
          `;

          const list = legendContainer.querySelector('ul');

          // Sort clusters by node count
          const sortedClusters = [...clusterConfig].sort((a, b) =>
            (nodesPerCluster[b.name] || 0) - (nodesPerCluster[a.name] || 0)
          );

          sortedClusters.forEach((cluster, index) => {
            const color = clusterColors[cluster.name];
            const count = nodesPerCluster[cluster.name] || 0;
            const isChecked = visibleClusters[cluster.name];
            const barWidth = (100 * count) / maxNodesPerCluster;

            const li = document.createElement('li');
            li.className = 'caption-row';
            li.title = `${count} page${count !== 1 ? 's' : ''}`;
            li.innerHTML = `
              <input type="checkbox" ${isChecked ? 'checked' : ''} id="cluster-${index}" />
              <label for="cluster-${index}">
                <span class="circle" style="background-color: ${color}; border-color: ${color};"></span>
                <div class="node-label">
                  <span>${cluster.name}</span>
                  <div class="bar" style="width: ${barWidth}%;"></div>
                </div>
              </label>
            `;

            li.querySelector('input').addEventListener('change', (e) => {
              visibleClusters[cluster.name] = e.target.checked;
              updateGraph();
              renderLegend();
            });

            list.appendChild(li);
          });

          // Add button handlers
          document.getElementById('check-all-btn').addEventListener('click', () => {
            clusterConfig.forEach(cluster => {
              visibleClusters[cluster.name] = true;
            });
            updateGraph();
            renderLegend();
          });

          document.getElementById('uncheck-all-btn').addEventListener('click', () => {
            clusterConfig.forEach(cluster => {
              visibleClusters[cluster.name] = false;
            });
            updateGraph();
            renderLegend();
          });
        };

        renderLegend();
      }
    } else if (legendContainer) {
      // Hide the cluster panel if no clusters configured
      legendContainer.style.display = 'none';
    }

    // Search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        const matches = nodeData.label.toLowerCase().includes(searchTerm);

        if (searchTerm === '') {
          graph.setNodeAttribute(node, 'color', nodeData.originalColor);
          graph.setNodeAttribute(node, 'size', 5);
        } else if (matches) {
          graph.setNodeAttribute(node, 'color', '#24B086');
          graph.setNodeAttribute(node, 'size', 7);
        } else {
          graph.setNodeAttribute(node, 'color', '#cccccc');
          graph.setNodeAttribute(node, 'size', 2);
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
