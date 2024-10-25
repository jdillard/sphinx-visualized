window.onload = function() {
    function linkArc(d) {
        const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
        return `
            M${d.source.x},${d.source.y}
            A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
        `;
    }

    drag = simulation => {

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    const width = 928;
    const height = 600;
    const types = Array.from(new Set(links_data.map(d => d.type)));
    const nodes = nodes_data
    const links = links_data

    let colorIndustry = [
        "#5A88B8",
        "#5A88B8",
        "#5A88B8",
        "#FFAB00",
        "#FFAB00",
        "#FFAB00",
        "#FFAB00",
        "#E96463",
        "#E96463",
        "#E96463",
        "#7CC4CC",
        "#7CC4CC",
        "#24B086",
        "#C3BD0C",
        "#C67194",
    ]
    const color = d3.scaleOrdinal(types, colorIndustry);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("x", d3.forceX())
        .force("y", d3.forceY());

    const svg = d3.select("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; font: 12px sans-serif;");

    // Per-type markers, as they don't inherit styles.
    svg.append("defs").selectAll("marker")
    .data(types)
    .join("marker")
        .attr("id", d => `arrow-${d}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -0.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
    .append("path")
        .attr("fill", color)
        .attr("d", "M0,-5L10,0L0,5");

    const link = svg.append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
    .selectAll("path")
    .data(links)
    .join("path")
        .attr("stroke", d => color(d.type))
        .attr("marker-end", d => `url(${new URL(`#arrow-${d.type}`, location)})`);

    const node = svg.append("g")
        .attr("fill", "currentColor")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
    .selectAll("g")
    .data(nodes)
    .join("g")
        .call(drag(simulation));

    node.append("circle")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .attr("r", 4);

    node.append("a")
        .attr("xlink:href", d => d.path)
        .append("text")
            .attr("x", 8)
            .attr("y", "0.31em")
            .text(d => d.label)
        .clone(true).lower()
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 3);

    simulation.on("tick", () => {
        link.attr("d", linkArc);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    svg.node()
};
