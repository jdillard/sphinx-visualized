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
            This graph visualizes your documentation's table of contents structure. It shows the hierarchical organization of pages as defined by <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">toctree</code> directives.
          </p>
          <p style="color: #666; font-size: 0.9em; margin-top: 0.5em; line-height: 1.5;">
            <strong>How to use:</strong>
          </p>
          <ul style="color: #666; font-size: 0.9em; line-height: 1.5;">
            <li>Click a label to navigate to that page</li>
            <li>Click parent nodes to expand/collapse branches</li>
            <li>Use expand/collapse all for quick navigation</li>
            <li>Drag and zoom to explore the tree structure</li>
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

  // Check if we have data
  if (!window.toctree || !window.toctree.label) {
    document.getElementById('graph-container').innerHTML =
      '<div style="padding: 50px; text-align: center;">No toctree data available.</div>';
    return;
  }

  // Specify the chart's dimensions
  const width = 1600;  // Increased width for more horizontal space
  const marginTop = 10;
  const marginRight = 10;
  const marginBottom = 10;
  const marginLeft = 40;

  // Rows are separated by dx pixels, columns by dy pixels
  const root = d3.hierarchy(window.toctree);
  const dx = 30; // Increased vertical spacing (was 20)

  // Load column spacing from localStorage or use default
  let dy = parseInt(localStorage.getItem('toctree-column-spacing')) || 200;

  // Update the spacing display and slider
  const updateSpacingDisplay = () => {
    const spacingValueEl = document.getElementById('spacing-value');
    const spacingSlider = document.getElementById('spacing-slider');
    if (spacingValueEl) {
      spacingValueEl.textContent = `${dy}px`;
    }
    if (spacingSlider) {
      spacingSlider.value = dy;
    }
  };
  updateSpacingDisplay();

  // Define the tree layout and the shape for links
  const tree = d3.tree().nodeSize([dx, dy]);
  const diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);

  // Create the SVG container with zoom capability
  const svg = d3.select("#graph-container").append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("style", "font: 12px sans-serif; user-select: none;");

  // Create a group for zoom/pan transformations
  const g = svg.append("g");

  // Add zoom behavior
  const zoom = d3.zoom()
      .scaleExtent([0.1, 4]) // Allow zoom from 10% to 400%
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

  svg.call(zoom);

  const gLink = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5);

  const gNode = g.append("g")
      .attr("cursor", "pointer")
      .attr("pointer-events", "all");

  function update(event, source) {
    const duration = event?.altKey ? 2500 : 250;
    const nodes = root.descendants().reverse();
    const links = root.links();

    // Compute the new tree layout
    tree(root);

    let left = root;
    let right = root;
    root.eachBefore(node => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    // Update the nodes
    const node = gNode.selectAll("g")
      .data(nodes, d => d.id);

    // Enter any new nodes at the parent's previous position
    const nodeEnter = node.enter().append("g")
        .attr("transform", d => {
          const parent = d.parent;
          const x = parent ? (parent.x0 !== undefined ? parent.x0 : parent.x) : source.x0;
          const y = parent ? (parent.y0 !== undefined ? parent.y0 : parent.y) : source.y0;
          return `translate(${y},${x})`;
        })
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .on("click", (event, d) => {
          // Navigate to page if it's a leaf node with a path
          if (d.data.path && !d._children && !d.children) {
            window.location.href = d.data.path;
          } else {
            // Otherwise toggle expand/collapse
            d.children = d.children ? null : d._children;
            update(event, d);
          }
        });

    nodeEnter.append("circle")
        .attr("r", 4)
        .attr("fill", d => d._children ? "#5A88B8" : "#24B086")
        .attr("stroke-width", 2);

    nodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d._children || d.children ? -8 : 8)
        .attr("text-anchor", d => d._children || d.children ? "end" : "start")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .attr("stroke", "white")
        .attr("paint-order", "stroke")
        .text(d => d.data.label)
        .style("fill", "#000")
        .style("cursor", d => d.data.path ? "pointer" : "default")
        .on("click", (event, d) => {
          // If this node has a path, navigate to it and stop propagation
          if (d.data.path) {
            event.stopPropagation();
            window.location.href = d.data.path;
          }
        });

    // Transition nodes to their new position
    const nodeUpdate = node.merge(nodeEnter).transition()
        .duration(duration)
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .attr("fill-opacity", 1)
        .attr("stroke-opacity", 1);

    // Transition exiting nodes to the parent's new position
    const nodeExit = node.exit().transition()
        .duration(duration)
        .remove()
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0);

    // Update the links
    const link = gLink.selectAll("path")
      .data(links, d => d.target.id);

    // Enter any new links at the parent's previous position
    const linkEnter = link.enter().append("path")
        .attr("d", d => {
          const o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o});
        });

    // Transition links to their new position
    link.merge(linkEnter).transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting links to the parent's new position
    link.exit().transition()
        .duration(duration)
        .remove()
        .attr("d", d => {
          const o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o});
        });

    // Stash the old positions for transition
    root.eachBefore(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Initialize the tree - start fully expanded
  root.x0 = 0;
  root.y0 = 0;
  root.descendants().forEach((d, i) => {
    d.id = i;
    d._children = d.children;
    // Start with root and first level expanded
    if (d.depth <= 1) {
      // Keep children visible
    } else {
      // Collapse deeper levels
      d.children = null;
    }
  });

  update(null, root);

  // Center the root node initially
  const initialTransform = d3.zoomIdentity
    .translate(width / 4, window.innerHeight / 2)
    .scale(0.8);
  svg.call(zoom.transform, initialTransform);

  // Set up zoom controls
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
  });

  document.getElementById('zoom-out')?.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.77);
  });

  document.getElementById('zoom-reset')?.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.transform, initialTransform);
  });

  // Toggle panels visibility
  document.getElementById('toggle-legend')?.addEventListener('click', () => {
    const panels = document.getElementById('panels');
    if (panels) {
      panels.style.display = panels.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Helper function to expand all nodes recursively
  function expandAll(d) {
    if (d._children) {
      d.children = d._children;
    }
    if (d.children) {
      d.children.forEach(expandAll);
    }
  }

  // Helper function to collapse all nodes recursively (except root)
  function collapseAll(d) {
    if (d.children) {
      d.children.forEach(collapseAll);
    }
    if (d.children && d.depth > 0) {
      d.children = null;
    }
  }

  // Expand all nodes
  document.getElementById('expand-all-btn')?.addEventListener('click', () => {
    expandAll(root);
    update(null, root);
  });

  // Collapse all nodes (except root)
  document.getElementById('collapse-all-btn')?.addEventListener('click', () => {
    collapseAll(root);
    update(null, root);
  });

  // Column spacing slider control
  document.getElementById('spacing-slider')?.addEventListener('input', (e) => {
    dy = parseInt(e.target.value);
    localStorage.setItem('toctree-column-spacing', dy);
    tree.nodeSize([dx, dy]);
    updateSpacingDisplay();
    update(null, root);
  });

  // Search functionality
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      gNode.selectAll("g").each(function(d) {
        const element = d3.select(this);
        const matches = d.data.label.toLowerCase().includes(searchTerm) ||
                       (d.data.path && d.data.path.toLowerCase().includes(searchTerm));

        if (!searchTerm) {
          // Reset highlighting when search is cleared
          element.select("text").style("fill", "#000");
          element.select("circle").attr("fill", d._children ? "#5A88B8" : "#24B086");
        } else if (matches) {
          // Highlight matching nodes
          element.select("text").style("fill", "#E96463");
          element.select("circle").attr("fill", "#E96463");
        } else {
          // Dim non-matching nodes
          element.select("text").style("fill", "#ccc");
          element.select("circle").attr("fill", "#E2E2E2");
        }
      });
    });
  }
});
