import Graph from 'graphology';
import random from 'graphology-layout/random';
import Sigma from 'sigma';

async function loadGraph(fileUrl) {
    const response = await fetch(fileUrl);
    const data = await response.json();
    
    const graph = new Graph();

    data.nodes.forEach(node => {
        graph.addNode(node.id, {label: node.label});
    });

    data.edges.forEach(edge => {
        graph.addEdge(edge.source, edge.target, {label: edge.label});
    });

    random.assign(graph);

    return graph;
}

// Load graph and initialize Sigma
loadGraph('graph.json')
    .then(graph => {
        const container = document.getElementById("graph-container");
        new Sigma(graph, container);
    });
