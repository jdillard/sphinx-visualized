// Includes Graph Visualization
// This script visualizes file inclusions (include and literalinclude directives)

import forceAtlas2 from 'https://cdn.skypack.dev/graphology-layout-forceatlas2';

// Color scheme for different node types
const TYPE_COLORS = {
  'document': '#5A88B8',     // Source documents (RST/MD files)
  'include': '#57a835',       // Included RST/MD/TXT files
  'literalinclude': '#d043c4' // Literal included files (code, etc.)
};

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

  // Load inclusion data
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  try {
    await loadScript('../js/includes-nodes.js');
    await loadScript('../js/includes-links.js');
  } catch (error) {
    console.error('Error loading data files:', error);
    document.getElementById('graph-container').innerHTML =
      '<div style="padding: 50px; text-align: center;">Error loading includes data. Make sure to build your documentation first.</div>';
    return;
  }

  const container = document.getElementById('graph-container');

  // Check if we have data
  if (!window.includes_nodes_data || window.includes_nodes_data.length === 0) {
    container.innerHTML = '<div style="padding: 50px; text-align: center;">No includes data available. Use .. include:: or .. literalinclude:: directives in your documentation.</div>';
    return;
  }

  // Create a new graphology graph
  const graph = new graphology.Graph();

  // Add nodes with random initial positions
  window.includes_nodes_data.forEach((node) => {
    const nodeType = node.type || 'document';
    const nodeColor = TYPE_COLORS[nodeType] || TYPE_COLORS['document'];

    graph.addNode(String(node.id), {
      label: node.label,
      path: node.path,
      fileType: nodeType,  // Use fileType instead of type to avoid Sigma conflicts
      size: nodeType === 'document' ? 8 : 5,
      color: nodeColor,
      originalColor: nodeColor,
      x: Math.random() * 100,
      y: Math.random() * 100
    });
  });

  // Add edges
  window.includes_links_data.forEach((link, index) => {
    try {
      graph.addEdge(String(link.target), String(link.source), {
        type: 'arrow',
        size: 2,
        inclusionType: link.type,
        count: link.count || 1
      });
    } catch (e) {
      console.warn('Skipping duplicate edge:', link);
    }
  });

  // Apply hierarchical layout - documents at top, included files below
  // Use ForceAtlas2 but with gravity based on node type
  const settings = forceAtlas2.inferSettings(graph);

  forceAtlas2.assign(graph, {
    iterations: 300,
    settings: {
      ...settings,
      gravity: 0.1,
      scalingRatio: 80,
      slowDown: 1,
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      strongGravityMode: false,
      outboundAttractionDistribution: true,
      linLogMode: false
    }
  });

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

    // Description panel functionality
    const descriptionContainer = document.getElementById('description-panel');
    if (descriptionContainer) {
      const renderDescriptionPanel = async () => {
        // Load chevron SVG
        const response = await fetch('../svg/chevron-down.svg');
        const chevronSvg = await response.text();

        descriptionContainer.innerHTML = `
          <div class="panel-header" id="description-panel-header">
            <h3 style="margin: 0; font-size: 1.3em;">
              About This Graph
            </h3>
            <span class="collapse-icon collapsed">${chevronSvg}</span>
          </div>
          <div class="panel-content collapsed" id="description-panel-content">
            <p style="color: #666; font-size: 0.9em; margin-top: 0.5em; line-height: 1.5;">
              This graph visualizes file inclusion relationships in your documentation. It shows which files are included into your source documents using <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">include</code> and <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">literalinclude</code> directives.
            </p>
            <p style="color: #666; font-size: 0.9em; margin-top: 0.5em; line-height: 1.5;">
              <strong>How to use:</strong>
            </p>
            <ul style="color: #666; font-size: 0.9em; line-height: 1.5;">
              <li>Click a document node to navigate to that page</li>
              <li>Hover over nodes to see inclusion relationships</li>
              <li>Filter by file type</li>
              <li>Zoom and pan to explore the network</li>
            </ul>
          </div>
        `;

        // Add collapse/expand functionality
        const panelHeader = document.getElementById('description-panel-header');
        const panelContent = document.getElementById('description-panel-content');
        const collapseIcon = panelHeader.querySelector('.collapse-icon');

        panelHeader.addEventListener('click', () => {
          panelContent.classList.toggle('collapsed');
          collapseIcon.classList.toggle('collapsed');
        });
      };

      renderDescriptionPanel();
    }

    // State for tracking hover
    let hoveredNode = null;
    let hoveredNeighbors = new Set();

    // Handle node clicks to navigate to pages
    renderer.on('clickNode', ({ node }) => {
      const nodeData = graph.getNodeAttributes(node);
      if (nodeData.path && nodeData.fileType === 'document') {
        // Only navigate for document nodes (not include/literalinclude)
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

    // Type filter panel functionality
    const typeContainer = document.getElementById('type-panel');
    if (typeContainer) {
      // Count nodes per type
      const nodesPerType = {};
      graph.forEachNode((node) => {
        const nodeData = graph.getNodeAttributes(node);
        const type = nodeData.fileType || 'document';
        nodesPerType[type] = (nodesPerType[type] || 0) + 1;
      });

      // Track which types are visible
      const visibleTypes = {
        'document': true,
        'include': true,
        'literalinclude': true
      };

      const updateGraphByType = () => {
        graph.forEachNode((node) => {
          const nodeData = graph.getNodeAttributes(node);
          const type = nodeData.fileType || 'document';

          if (visibleTypes[type]) {
            graph.setNodeAttribute(node, 'hidden', false);
          } else {
            graph.setNodeAttribute(node, 'hidden', true);
          }
        });
      };

      const renderTypePanel = async () => {
        const types = Object.keys(TYPE_COLORS);
        const visibleCount = types.filter(t => visibleTypes[t]).length;

        const typeLabels = {
          'document': 'Documents',
          'include': 'Included Files',
          'literalinclude': 'Code Inclusions'
        };

        // Load chevron SVG
        const response = await fetch('../svg/chevron-down.svg');
        const chevronSvg = await response.text();

        typeContainer.innerHTML = `
          <div class="panel-header" id="type-panel-header">
            <h3 style="margin: 0; font-size: 1.3em;">
              File Types
              ${visibleCount < types.length ? `<span style="color: #666; font-size: 0.8em;"> (${visibleCount} / ${types.length})</span>` : ''}
            </h3>
            <span class="collapse-icon">${chevronSvg}</span>
          </div>
          <div class="panel-content" id="type-panel-content">
            <p style="color: #666; font-style: italic; font-size: 0.9em; margin-top: 0.5em;">
              Click a type to show/hide related files.
            </p>
            <ul style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
        `;

        const list = typeContainer.querySelector('ul');

        types.forEach((type, index) => {
          const count = nodesPerType[type] || 0;
          if (count === 0) return; // Skip types with no nodes

          const isChecked = visibleTypes[type];
          const color = TYPE_COLORS[type];
          const label = typeLabels[type] || type;

          const li = document.createElement('li');
          li.className = 'caption-row';
          li.title = `${count} file${count !== 1 ? 's' : ''}`;
          li.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} id="type-${index}" />
            <label for="type-${index}">
              <span class="circle" style="background-color: ${color}; border-color: ${color};"></span>
              <div class="node-label">
                <span>${label} (${count})</span>
              </div>
            </label>
          `;

          li.querySelector('input').addEventListener('change', (e) => {
            visibleTypes[type] = e.target.checked;
            updateGraphByType();
            renderTypePanel();
          });

          list.appendChild(li);
        });

        // Add collapse/expand functionality
        const panelHeader = document.getElementById('type-panel-header');
        const panelContent = document.getElementById('type-panel-content');
        const collapseIcon = panelHeader.querySelector('.collapse-icon');

        panelHeader.addEventListener('click', () => {
          panelContent.classList.toggle('collapsed');
          collapseIcon.classList.toggle('collapsed');
        });
      };

      renderTypePanel();
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
