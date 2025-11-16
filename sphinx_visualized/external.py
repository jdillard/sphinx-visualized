#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
External project integration for sphinx-visualized.

This module handles fetching and merging graph data from external Sphinx projects
that also use the sphinx-visualized extension.
"""

import json
import os
import urllib.request
import urllib.error
from sphinx.util import logging

logger = logging.getLogger(__name__)


def fetch_external_project_data(app, project_name):
    """
    Fetch graphson.json data from an external intersphinx project.

    Args:
        app: Sphinx application object
        project_name: Name of the project in intersphinx_mapping

    Returns:
        Dictionary with graphson data if successful, None otherwise
    """
    intersphinx_mapping = getattr(app.config, 'intersphinx_mapping', {})

    if project_name not in intersphinx_mapping:
        logger.warning(f"Project '{project_name}' not found in intersphinx_mapping")
        return None

    project_info = intersphinx_mapping[project_name]

    # Extract base URL from intersphinx_mapping format
    base_url = None
    if isinstance(project_info, tuple):
        if len(project_info) >= 2 and isinstance(project_info[1], tuple):
            # Processed format: ('sphinx', ('https://...', (None,)))
            base_url = project_info[1][0] if len(project_info[1]) > 0 else None
        elif len(project_info) >= 1:
            # Original format: ('https://...', None)
            base_url = project_info[0]
    else:
        base_url = project_info

    if not base_url:
        logger.warning(f"Could not extract URL for project '{project_name}'")
        return None

    # Normalize URL and construct graphson.json path
    base_url = base_url.rstrip('/')

    # Check if base_url is a local path or URL
    is_local_path = not base_url.startswith(('http://', 'https://', 'file://'))

    if is_local_path:
        # Handle local file path
        # Convert relative path to absolute based on the conf.py location
        if not os.path.isabs(base_url):
            # Get the source directory (where conf.py is located)
            confdir = app.confdir
            base_url = os.path.abspath(os.path.join(confdir, base_url))

        graphson_path = os.path.join(base_url, '_static', 'sphinx-visualized', 'graphson.json')

        try:
            if not os.path.exists(graphson_path):
                logger.warning(f"Could not find graphson.json for '{project_name}' at {graphson_path}. "
                              f"The project may not have sphinx-visualized extension installed or not built yet.")
                return None

            with open(graphson_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {
                    'data': data,
                    'base_url': base_url,
                    'project_name': project_name
                }
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON data for '{project_name}': {e}")
            return None
        except Exception as e:
            logger.warning(f"Error reading local file for '{project_name}': {e}")
            return None
    else:
        # Handle remote URL
        graphson_url = f"{base_url}/_static/sphinx-visualized/graphson.json"

        try:
            with urllib.request.urlopen(graphson_url, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                return {
                    'data': data,
                    'base_url': base_url,
                    'project_name': project_name
                }
        except urllib.error.HTTPError as e:
            logger.warning(f"Could not fetch graphson.json for '{project_name}' (HTTP {e.code}). "
                          f"The project may not have sphinx-visualized extension installed.")
            return None
        except urllib.error.URLError as e:
            logger.warning(f"Network error fetching data for '{project_name}': {e.reason}")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON data for '{project_name}': {e}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error fetching data for '{project_name}': {e}")
            return None


def merge_external_project_data(app, home_nodes, home_links, external_project_data, home_page_list):
    """
    Merge external project data into the home project's graph.

    Args:
        app: Sphinx application object
        home_nodes: List of nodes from the home project
        home_links: List of links from the home project
        external_project_data: Dictionary with external project data
        home_page_list: List of page identifiers from home project

    Returns:
        Tuple of (merged_nodes, merged_links, node_id_offset)
    """
    if not external_project_data or 'data' not in external_project_data:
        return home_nodes, home_links, len(home_nodes)

    graphson_data = external_project_data['data']
    base_url = external_project_data['base_url']
    project_name = external_project_data['project_name']

    # Offset for external node IDs to avoid conflicts
    # Use max ID + 1 to handle sparse/non-sequential IDs
    node_id_offset = max([n['id'] for n in home_nodes]) + 1 if home_nodes else 0

    # Track which external nodes connect to home project
    external_nodes_with_home_connections = set()

    # First pass: identify connections between external project and home project
    # Check if any home nodes link to external project URLs
    for home_node in home_nodes:
        if home_node.get('is_intersphinx'):
            node_path = home_node.get('path', '')

            # Normalize the path to absolute if it's relative
            if not node_path.startswith(('http://', 'https://', 'file://')):
                # It's a relative path - convert to absolute
                if not os.path.isabs(node_path):
                    confdir = app.confdir
                    # Remove leading ../../../ and make absolute
                    node_path = os.path.abspath(os.path.join(confdir, node_path))

            # Check if this path is under the base_url directory
            # Strip fragments for comparison
            node_path_base = node_path.split('#')[0]
            base_url_normalized = base_url.split('#')[0]

            if node_path_base.startswith(base_url_normalized):
                # This home node is actually a reference to the external project
                # Mark it for later matching (store with fragment for specific matching)
                external_nodes_with_home_connections.add(node_path)

    # Create mapping of external URLs to new node IDs
    external_url_to_node = {}
    merged_nodes = list(home_nodes)

    # Add external project nodes with offset IDs (only internal pages, not their external references)
    for vertex in graphson_data.get('vertices', []):
        # Skip external/intersphinx nodes from the external project
        # We only want their internal documentation pages
        if vertex.get('label') in ['external', 'intersphinx', 'external_project']:
            continue
        if vertex.get('properties', {}).get('is_external') or vertex.get('properties', {}).get('is_intersphinx'):
            continue

        original_id = vertex['id']
        new_id = original_id + node_id_offset

        # Construct full URL for this external node
        node_path = vertex['properties'].get('path', '')

        # Handle relative paths from external project
        if node_path.startswith('../../../'):
            # Convert relative path to absolute URL
            relative_path = node_path.replace('../../../', '')
            full_url = f"{base_url}/{relative_path}"
        else:
            full_url = node_path

        # Check if this external node connects to home project
        # Need to check both exact match and base path match (without fragment)
        full_url_base = full_url.split('#')[0]
        has_home_connection = any(
            ref == full_url or ref.split('#')[0] == full_url_base
            for ref in external_nodes_with_home_connections
        )

        # All nodes from external project go into single cluster named after the project
        # (ignore the external project's internal cluster structure)
        # Use "(external)" suffix to match existing intersphinx node pattern
        cluster_name = f"{project_name} (external)"

        merged_nodes.append({
            'id': new_id,
            'label': vertex['properties'].get('name', ''),
            'path': full_url,
            'cluster': cluster_name,
            'is_external_project': True,
            'external_project_name': project_name,
            'has_home_connection': has_home_connection,
        })

        # Store both with and without fragments for matching
        external_url_to_node[full_url] = new_id
        external_url_to_node[full_url_base] = new_id

    # Create mapping from old intersphinx node IDs to new external project node IDs
    node_id_redirect = {}
    intersphinx_node_ids_to_remove = set()

    for home_node in merged_nodes:
        # ONLY process nodes that are explicitly marked as intersphinx
        # This ensures we don't accidentally remove home project's internal nodes
        if not home_node.get('is_intersphinx'):
            continue

        node_path = home_node.get('path', '')

        # Normalize the path to absolute if it's relative
        if not node_path.startswith(('http://', 'https://', 'file://')):
            if not os.path.isabs(node_path):
                confdir = app.confdir
                node_path = os.path.abspath(os.path.join(confdir, node_path))

        # Check if this path matches the base_url
        node_path_base = node_path.split('#')[0]
        if node_path_base.startswith(base_url.split('#')[0]):
            # Try to find matching external node (try both with and without fragment)
            matched_id = external_url_to_node.get(node_path) or external_url_to_node.get(node_path_base)
            if matched_id:
                # Map the old intersphinx stub node ID to the actual external project node ID
                old_id = home_node['id']
                new_id = matched_id
                node_id_redirect[old_id] = new_id
                # Mark this intersphinx stub node for removal (we'll use the full external node instead)
                intersphinx_node_ids_to_remove.add(old_id)

    # Remove intersphinx stub nodes that have been replaced by full external project nodes
    # Only remove nodes that are in the removal set (these should only be intersphinx stubs)
    merged_nodes = [n for n in merged_nodes if n['id'] not in intersphinx_node_ids_to_remove]

    # Update home links to redirect edges from intersphinx stubs to actual external nodes
    merged_links = []
    for link in home_links:
        source_id = link['source']
        target_id = link['target']

        # Redirect if either endpoint is an intersphinx stub that now has a real external node
        if source_id in node_id_redirect:
            source_id = node_id_redirect[source_id]
        if target_id in node_id_redirect:
            target_id = node_id_redirect[target_id]

        merged_links.append({
            **link,
            'source': source_id,
            'target': target_id,
        })

    # Add external project edges with offset IDs (only edges between internal nodes)
    for edge in graphson_data.get('edges', []):
        # Check if both nodes are in external project (not connected to home)
        source_id = edge['outV'] + node_id_offset
        target_id = edge['inV'] + node_id_offset

        # Find if either endpoint connects to home
        source_node = next((n for n in merged_nodes if n['id'] == source_id), None)
        target_node = next((n for n in merged_nodes if n['id'] == target_id), None)

        # Skip edges where either node was filtered out (external/intersphinx nodes)
        if not source_node or not target_node:
            continue

        has_home_connection = False
        if source_node and source_node.get('has_home_connection'):
            has_home_connection = True
        if target_node and target_node.get('has_home_connection'):
            has_home_connection = True

        merged_links.append({
            'source': source_id,
            'target': target_id,
            'strength': edge['properties'].get('strength', 1),
            'reference_count': edge['properties'].get('reference_count', 1),
            'type': edge['label'],
            'types': edge['properties'].get('types', [edge['label']]),
            'is_external_project': True,
            'external_project_name': project_name,
            'has_home_connection': has_home_connection,
        })

    return merged_nodes, merged_links, node_id_offset
