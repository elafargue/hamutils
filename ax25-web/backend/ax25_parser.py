#!/usr/bin/env python3
"""
AX25 Network Parser - Based on ax25_graph.py
Extracts network topology and hearable nodes from AX25 listen logs
"""

import re
from collections import defaultdict
from typing import Set, Dict, Tuple, List
from dataclasses import dataclass

@dataclass
class NetworkTopology:
    """Represents the current state of the AX25 network"""
    nodes: Set[str]
    edges: List[Dict]
    hearable_nodes: Set[str]
    node_counts: Dict[str, int]
    edge_counts: Dict[Tuple[str, str], int]

class AX25Parser:
    def __init__(self):
        # Match "fm <SRC> to <DST>" anywhere (syslog-safe)
        self.src_re = re.compile(r"\bfm\s+(\S+)\s+to\s+\S+", re.IGNORECASE)
        
        # Capture everything after "via" up to 'ctl' or 'pid=' or 'len' or EOL
        self.via_re = re.compile(r"\bvia\b(.*?)(?=\bctl\b|\bpid\s*=\b|\blen\b|$)", re.IGNORECASE)
    
    def strip_ssid(self, call: str, keep: bool = False) -> str:
        """Remove SSID from callsign unless keep is True"""
        if keep:
            return call
        return call.split('-', 1)[0]
    
    def tokenize_path(self, path_segment: str) -> List[str]:
        """Split path segment into individual callsign tokens"""
        raw = path_segment.strip().split()
        tokens = []
        for t in raw:
            t = t.strip().strip(",;:/()[]{}")
            if t:
                tokens.append(t)
        return tokens
    
    def parse_lines(self, lines: List[str], keep_ssid: bool = False) -> NetworkTopology:
        """
        Parse AX25 log lines and return network topology
        
        Hearable nodes are determined by:
        1. Direct transmission (no via path)
        2. At least one via path with no asterisks (undigipeated transmission)
        
        Returns:
            NetworkTopology with nodes, edges, and hearable nodes
        """
        edges = set()
        edge_counts = defaultdict(int)
        nodes_all = set()
        hearable_nodes = set()
        node_counts = defaultdict(int)

        for line in lines:
            # Ensure we're operating on a plain str
            if not isinstance(line, str):
                try:
                    line = line.decode("utf-8", "ignore")
                except Exception:
                    continue

            # Skip packet content lines (hex dump lines containing ": 0000 ")
            # These lines contain packet payload, not routing information
            if ': 0000 ' in line:
                continue

            # Source (leaf station)
            src = None
            msrc = self.src_re.search(line)
            if msrc:
                src = self.strip_ssid(msrc.group(1), keep_ssid)
                if src:
                    nodes_all.add(src)
                    node_counts[src] += 1

            # Check for via path
            mvia = self.via_re.search(line)
            
            # If no via path, the source is directly hearable
            if not mvia and src:
                hearable_nodes.add(src)
                continue
            
            # If there is a via path, check if any path has no asterisks
            if mvia:
                tokens = self.tokenize_path(mvia.group(1))
                
                # Track all VIA tokens as nodes (with stars removed)
                cleaned = [self.strip_ssid(tok.replace("*", ""), keep_ssid) for tok in tokens]
                for c in cleaned:
                    if c:
                        nodes_all.add(c)
                        node_counts[c] += 1

                # Check if source is hearable: if any path exists with no asterisks
                has_undigipeated_path = any("*" not in tok for tok in tokens)
                if has_undigipeated_path and src:
                    hearable_nodes.add(src)
                
                # Also identify hearable digipeaters: the last digipeater with an asterisk
                # is the one we can hear directly (per AX25.md rules)
                starred_tokens = [(i, tok) for i, tok in enumerate(tokens) if "*" in tok]
                if starred_tokens:
                    # Find the last (rightmost) starred digipeater
                    last_starred_idx, last_starred_tok = max(starred_tokens, key=lambda x: x[0])
                    last_starred_call = self.strip_ssid(last_starred_tok.replace("*", ""), keep_ssid)
                    if last_starred_call:
                        hearable_nodes.add(last_starred_call)

                # Build hop->next edges for each starred hop
                for i, tok in enumerate(tokens):
                    starred = "*" in tok
                    if starred and i + 1 < len(tokens):
                        a = self.strip_ssid(tok.replace("*", ""), keep_ssid)
                        b = self.strip_ssid(tokens[i+1].replace("*", ""), keep_ssid)
                        if a and b and a != b:
                            edges.add((a, b))
                            edge_counts[(a, b)] += 1

        # Convert edges to list of dicts for JSON serialization
        edges_list = []
        for (source, target) in edges:
            edges_list.append({
                "id": f"{source}-{target}",
                "source": source,
                "target": target,
                "label": str(edge_counts[(source, target)]),
                "count": edge_counts[(source, target)]
            })

        return NetworkTopology(
            nodes=nodes_all,
            edges=edges_list,
            hearable_nodes=hearable_nodes,
            node_counts=dict(node_counts),
            edge_counts=dict(edge_counts)
        )
    
    def parse_file(self, filepath: str, keep_ssid: bool = False) -> NetworkTopology:
        """Parse an AX25 log file and return network topology"""
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            return self.parse_lines(lines, keep_ssid)
        except Exception as e:
            print(f"Error parsing file {filepath}: {e}")
            return NetworkTopology(
                nodes=set(),
                edges=[],
                hearable_nodes=set(),
                node_counts={},
                edge_counts={}
            )