// Toctree Graph Visualization using Sigma.js
// This script visualizes the documentation table of contents structure

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

  const container = document.getElementById('graph-container');

  // Check if we have data
  if (!window.toctree || !window.toctree.label) {
    container.innerHTML = '<div style="padding: 50px; text-align: center;">No toctree data available.</div>';
    return;
  }

  // Create a new graphology graph
  const graph = new graphology.Graph();

  // Convert hierarchical data to flat nodes and edges
  let nodeId = 0;
  const nodeMap = new Map();

  // Depth-based colors - lighter colors for deeper levels
  const DEPTH_COLORS = [
    '#5A88B8',  // Level 0 - Root (blue)
    '#24B086',  // Level 1 (green)
    '#C3BD0C',  // Level 2 (yellow)
    '#E96463',  // Level 3 (red)
    '#7CC4CC',  // Level 4 (cyan)
    '#C67194',  // Level 5+ (pink)
  ];

  const getColorForDepth = (depth) => {
    return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  };

  // Recursively traverse the tree to add nodes and edges
  const traverseTree = (node, parentId = null, depth = 0, x = 0, y = 0) => {
    const currentId = String(nodeId++);
    const color = getColorForDepth(depth);

    // Calculate size based on depth (root is largest)
    const size = depth === 0 ? 12 : Math.max(5, 10 - depth);

    // Add node to graph
    graph.addNode(currentId, {
      label: node.label,
      path: node.path || '',
      depth: depth,
      size: size,
      color: color,
      originalColor: color,
      x: x,
      y: y,
      hasChildren: node.children && node.children.length > 0
    });

    nodeMap.set(currentId, { node, depth });

    // Add edge from parent if exists
    if (parentId !== null) {
      graph.addEdge(parentId, currentId, {
        type: 'arrow',
        size: 2,
        color: '#999'
      });
    }

    // Recursively process children
    if (node.children && node.children.length > 0) {
      const childSpacing = 150;
      const childStartX = x - (node.children.length - 1) * childSpacing / 2;

      node.children.forEach((child, index) => {
        const childX = childStartX + index * childSpacing;
        const childY = y + 100; // Vertical spacing between levels
        traverseTree(child, currentId, depth + 1, childX, childY);
      });
    }

    return currentId;
  };

  // Start traversing from root
  traverseTree(window.toctree, null, 0, 0, 0);

  // Create the sigma instance
  try {
    const renderer = new Sigma(graph, container, {
      renderEdgeLabels: false,
      defaultNodeColor: '#5A88B8',
      defaultEdgeColor: '#999',
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
        const nodeData = graph.getNodeAttributes(node);
        graph.setNodeAttribute(node, 'color', nodeData.originalColor);
        graph.setNodeAttribute(node, 'highlighted', false);
      });

      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', '#999');
        graph.setEdgeAttribute(edge, 'highlighted', false);
      });
    });

    // Depth filter panel functionality
    const depthContainer = document.getElementById('depth-panel');
    if (depthContainer) {
      // Find max depth
      let maxDepth = 0;
      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        maxDepth = Math.max(maxDepth, nodeData.depth);
      });

      // Count nodes per depth
      const nodesPerDepth = {};
      for (let i = 0; i <= maxDepth; i++) {
        nodesPerDepth[i] = 0;
      }
      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        nodesPerDepth[nodeData.depth]++;
      });

      // Track which depths are visible
      const visibleDepths = {};
      for (let i = 0; i <= maxDepth; i++) {
        visibleDepths[i] = true;
      }

      const updateGraphByDepth = () => {
        graph.forEachNode((node) => {
          const nodeData = graph.getNodeAttributes(node);
          const depth = nodeData.depth;

          if (visibleDepths[depth]) {
            graph.setNodeAttribute(node, 'hidden', false);
          } else {
            graph.setNodeAttribute(node, 'hidden', true);
          }
        });
      };

      const renderDepthPanel = () => {
        const depths = Object.keys(nodesPerDepth).map(Number);
        const visibleCount = depths.filter(d => visibleDepths[d]).length;

        const depthLabels = [
          'Root',
          'Level 1',
          'Level 2',
          'Level 3',
          'Level 4',
          'Level 5+'
        ];

        depthContainer.innerHTML = `
          <h3>
            Tree Depth
            ${visibleCount < depths.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${depths.length})</span>` : ''}
          </h3>
          <div class="panel-content">
            <p style="color: #666; font-style: italic; font-size: 0.9em; margin-top: 0.5em;">
              Click a level to show/hide nodes.
            </p>
            <ul style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
        `;

        const list = depthContainer.querySelector('ul');

        depths.forEach((depth, index) => {
          const count = nodesPerDepth[depth] || 0;
          if (count === 0) return; // Skip depths with no nodes

          const isChecked = visibleDepths[depth];
          const color = getColorForDepth(depth);
          const label = depthLabels[Math.min(depth, depthLabels.length - 1)];

          const li = document.createElement('li');
          li.className = 'caption-row';
          li.title = `${count} node${count !== 1 ? 's' : ''}`;
          li.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} id="depth-${index}" />
            <label for="depth-${index}">
              <span class="circle" style="background-color: ${color}; border-color: ${color};"></span>
              <div class="node-label">
                <span>${label} (${count})</span>
              </div>
            </label>
          `;

          li.querySelector('input').addEventListener('change', (e) => {
            visibleDepths[depth] = e.target.checked;
            updateGraphByDepth();
            renderDepthPanel();
          });

          list.appendChild(li);
        });
      };

      renderDepthPanel();
    }

    // Search functionality
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        if (!searchTerm) {
          // Reset all nodes when search is cleared
          graph.forEachNode((node) => {
            const nodeData = graph.getNodeAttributes(node);
            graph.setNodeAttribute(node, 'color', nodeData.originalColor);
            graph.setNodeAttribute(node, 'highlighted', false);
          });
          graph.forEachEdge((edge) => {
            graph.setEdgeAttribute(edge, 'color', '#999');
            graph.setEdgeAttribute(edge, 'highlighted', false);
          });
          return;
        }

        // Dim all nodes and edges first
        graph.forEachNode((node) => {
          graph.setNodeAttribute(node, 'color', '#E2E2E2');
          graph.setNodeAttribute(node, 'highlighted', false);
        });
        graph.forEachEdge((edge) => {
          graph.setEdgeAttribute(edge, 'color', '#E2E2E2');
          graph.setEdgeAttribute(edge, 'highlighted', false);
        });

        // Highlight matching nodes
        graph.forEachNode((node) => {
          const nodeData = graph.getNodeAttributes(node);
          if (nodeData.label.toLowerCase().includes(searchTerm) ||
              nodeData.path.toLowerCase().includes(searchTerm)) {
            graph.setNodeAttribute(node, 'color', '#E96463');
            graph.setNodeAttribute(node, 'highlighted', true);

            // Highlight connected edges
            graph.forEachEdge(node, (edge) => {
              graph.setEdgeAttribute(edge, 'color', '#5A88B8');
              graph.setEdgeAttribute(edge, 'highlighted', true);
            });
          }
        });
      });
    }

    // Graph controls
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      const camera = renderer.getCamera();
      camera.animatedZoom({ duration: 200 });
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
      const camera = renderer.getCamera();
      camera.animatedUnzoom({ duration: 200 });
    });

    document.getElementById('zoom-reset')?.addEventListener('click', () => {
      const camera = renderer.getCamera();
      camera.animatedReset({ duration: 200 });
    });

    // Toggle legend (panels) visibility
    document.getElementById('toggle-legend')?.addEventListener('click', () => {
      const panels = document.getElementById('panels');
      if (panels.style.display === 'none') {
        panels.style.display = 'block';
      } else {
        panels.style.display = 'none';
      }
    });

  } catch (error) {
    console.error('Error creating visualization:', error);
    container.innerHTML = '<div style="padding: 50px; text-align: center;">Error creating visualization: ' + error.message + '</div>';
  }
});