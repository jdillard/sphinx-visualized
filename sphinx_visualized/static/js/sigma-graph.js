// Sigma.js Graph Visualization
// This script loads GraphSON data and renders it using sigma.js

import forceAtlas2 from 'https://cdn.skypack.dev/graphology-layout-forceatlas2';

// Default color palette inspired by sigmajs.org
const DEFAULT_COLORS = [
  '#6c3e81', '#57a835', '#7145cd', '#579f5f',
  '#d043c4', '#477028', '#b174cb', '#a4923a',
  '#5f83cc', '#db4139', '#379982', '#c94c83',
  '#7c5d28', '#a54a49', '#cf7435'
];

window.addEventListener('DOMContentLoaded', async () => {
  // Load SVG icons for control buttons
  const loadControlIcons = async () => {
    const controls = [
      { id: 'zoom-in', svg: '../svg/magnifying-glass-plus.svg' },
      { id: 'zoom-out', svg: '../svg/magnifying-glass-minus.svg' },
      { id: 'zoom-reset', svg: '../svg/viewfinder.svg' },
      { id: 'toggle-legend', svg: '../svg/map.svg' }
    ];

    for (const control of controls) {
      try {
        const response = await fetch(control.svg);
        const svgContent = await response.text();
        const button = document.getElementById(control.id);
        if (button) {
          button.innerHTML = svgContent;
        }
      } catch (error) {
        console.error(`Error loading icon for ${control.id}:`, error);
      }
    }
  };

  await loadControlIcons();

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

  // Define category colors and icons (for node types, not clusters)
  const GRAY_COLOR = '#999999';
  const CATEGORY_CONFIG = {
    'Internal Pages': {
      color: GRAY_COLOR,
      icon: '../svg/document.svg'
    },
    'Intersphinx Pages': {
      color: GRAY_COLOR,
      icon: '../svg/external.svg'
    }
  };

  // Create a new graphology graph
  const graph = new graphology.Graph();

  // Add nodes from GraphSON vertices with random initial positions
  graphsonData.vertices.forEach((vertex, index) => {
    const cluster = vertex.properties.cluster;
    const isIntersphinx = vertex.label === 'intersphinx' || vertex.properties.is_intersphinx;

    // Determine category based on node type
    const category = isIntersphinx ? 'Intersphinx Pages' : 'Internal Pages';

    // Use cluster colors for nodes
    let nodeColor;
    if (cluster && clusterColors[cluster]) {
      nodeColor = clusterColors[cluster];
    } else {
      // Default color for nodes without a cluster
      nodeColor = '#5A88B8';
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

      const renderCategoryPanel = async () => {
        const categories = Object.keys(CATEGORY_CONFIG);
        const visibleCount = categories.filter(c => visibleCategories[c]).length;

        // Calculate max nodes for progress bar scaling
        const maxNodesPerCategory = Math.max(...categories.map(c => nodesPerCategory[c] || 0));

        // Load chevron SVG
        const response = await fetch('../svg/chevron-down.svg');
        const chevronSvg = await response.text();

        categoryContainer.innerHTML = `
          <div class="panel-header" id="category-panel-header">
            <h3 style="margin: 0; font-size: 1.3em;">
              Categories
              ${visibleCount < categories.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${categories.length})</span>` : ''}
            </h3>
            <span class="collapse-icon">${chevronSvg}</span>
          </div>
          <div class="panel-content" id="category-panel-content">
            <p style="color: #666; font-style: italic; font-size: 0.9em; margin-top: 0.5em;">Click a category to show/hide related pages from the network.</p>
            <p class="cluster-buttons">
              <button id="check-all-categories-btn" class="cluster-btn">☑ Check all</button>
              <button id="uncheck-all-categories-btn" class="cluster-btn">☐ Uncheck all</button>
            </p>
            <ul style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
        `;

        const list = categoryContainer.querySelector('ul');

        // Load and render categories with icons
        for (let index = 0; index < categories.length; index++) {
          const category = categories[index];
          const config = CATEGORY_CONFIG[category];
          const count = nodesPerCategory[category] || 0;
          const isChecked = visibleCategories[category];
          const barWidth = maxNodesPerCategory > 0 ? (100 * count) / maxNodesPerCategory : 0;

          // Fetch SVG content
          let svgContent = '';
          try {
            const response = await fetch(config.icon);
            svgContent = await response.text();
          } catch (error) {
            console.error(`Error loading icon for ${category}:`, error);
          }

          const li = document.createElement('li');
          li.className = 'caption-row';
          li.title = `${count} node${count !== 1 ? 's' : ''}`;
          li.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} id="category-${index}" />
            <label for="category-${index}">
              <span class="icon-container">${svgContent}</span>
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
        }

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

        // Add collapse/expand functionality
        const panelHeader = document.getElementById('category-panel-header');
        const panelContent = document.getElementById('category-panel-content');
        const collapseIcon = panelHeader.querySelector('.collapse-icon');

        panelHeader.addEventListener('click', () => {
          panelContent.classList.toggle('collapsed');
          collapseIcon.classList.toggle('collapsed');
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

        const renderLegend = async () => {
          const visibleCount = Object.values(visibleClusters).filter(v => v).length;

          // Load chevron SVG
          const response = await fetch('../svg/chevron-down.svg');
          const chevronSvg = await response.text();

          legendContainer.innerHTML = `
            <div class="panel-header" id="cluster-panel-header">
              <h3 style="margin: 0; font-size: 1.3em;">
                Clusters
                ${visibleCount < clusterConfig.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${clusterConfig.length})</span>` : ''}
              </h3>
              <span class="collapse-icon">${chevronSvg}</span>
            </div>
            <div class="panel-content" id="cluster-panel-content">
              <p style="color: #666; font-style: italic; font-size: 0.9em; margin-top: 0.5em;">Click a cluster to show/hide related pages from the network.</p>
              <p class="cluster-buttons">
                <button id="check-all-btn" class="cluster-btn">☑ Check all</button>
                <button id="uncheck-all-btn" class="cluster-btn">☐ Uncheck all</button>
              </p>
              <ul style="list-style: none; padding: 0; margin: 0;"></ul>
            </div>
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

          // Add collapse/expand functionality
          const panelHeader = document.getElementById('cluster-panel-header');
          const panelContent = document.getElementById('cluster-panel-content');
          const collapseIcon = panelHeader.querySelector('.collapse-icon');

          panelHeader.addEventListener('click', () => {
            panelContent.classList.toggle('collapsed');
            collapseIcon.classList.toggle('collapsed');
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

    // Zoom controls in lower left
    document.getElementById('zoom-in').addEventListener('click', () => {
      const camera = renderer.getCamera();
      const currentRatio = camera.ratio;
      camera.animate({ ratio: currentRatio / 1.5 }, { duration: 200 });
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      const camera = renderer.getCamera();
      const currentRatio = camera.ratio;
      camera.animate({ ratio: currentRatio * 1.5 }, { duration: 200 });
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
      const camera = renderer.getCamera();
      camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 500 });
    });

    // Toggle legend (panels) visibility
    document.getElementById('toggle-legend').addEventListener('click', () => {
      const panels = document.getElementById('panels');
      if (panels.style.display === 'none') {
        panels.style.display = 'block';
      } else {
        panels.style.display = 'none';
      }
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
