#!/usr/bin/env python3
"""
AX25 Network Parser - Based on ax25_graph.py
Extracts network topology and hearable nodes from AX25 listen logs
Also tracks ID and BEACON stations
"""

import re
import json
import os
from collections import defaultdict
from typing import Set, Dict, Tuple, List, Optional
from dataclasses import dataclass
from datetime import datetime

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


@dataclass
class NodeRecord:
    """Represents a single node's information from ID/BEACON packets"""
    callsign: str
    latest_payload: str
    last_timestamp: str
    packet_type: str  # "ID" or "BEACON"
    first_seen: str


class NodeDatabase:
    """Manages a database of nodes that have sent ID or BEACON packets"""
    
    def __init__(self, db_file: str = "nodes_database.json"):
        self.db_file = db_file
        self.nodes: Dict[str, NodeRecord] = {}
        self.load_database()
        
        # Regex patterns for parsing packets
        self.packet_header_re = re.compile(r"\bfm\s+(\S+)\s+to\s+(ID|BEACON)", re.IGNORECASE)
        self.timestamp_re = re.compile(r"(\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
        self.payload_re = re.compile(r"(\d{4})\s+(.+)", re.IGNORECASE)  # Use search, not match
    
    def load_database(self):
        """Load existing node database from file"""
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.nodes = {
                        callsign: NodeRecord(**record_data) 
                        for callsign, record_data in data.items()
                    }
            except Exception as e:
                print(f"Error loading node database: {e}")
                self.nodes = {}
        else:
            self.nodes = {}
    
    def save_database(self):
        """Save node database to file"""
        try:
            data = {
                callsign: {
                    'callsign': record.callsign,
                    'latest_payload': record.latest_payload,
                    'last_timestamp': record.last_timestamp,
                    'packet_type': record.packet_type,
                    'first_seen': record.first_seen
                }
                for callsign, record in self.nodes.items()
            }
            
            with open(self.db_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving node database: {e}")
    
    def parse_lines(self, lines: List[str]):
        """Parse lines and extract ID/BEACON packets with multi-line payloads"""
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Look for packet header
            header_match = self.packet_header_re.search(line)
            if header_match:
                callsign = header_match.group(1)
                packet_type = header_match.group(2).upper()
                
                # Extract timestamp
                timestamp_match = self.timestamp_re.search(line)
                timestamp = timestamp_match.group(1) if timestamp_match else "unknown"
                
                # Collect multi-line payload
                payload_parts = []
                j = i + 1
                
                # Look for payload lines starting with hex offsets (0000, 0040, etc.)
                while j < len(lines):
                    payload_line = lines[j].strip()
                    
                    # Check if this line is a payload line with hex offset
                    payload_match = self.payload_re.search(payload_line)  # Use search instead of match
                    if payload_match:
                        offset = payload_match.group(1)
                        content = payload_match.group(2)
                        payload_parts.append(content)
                        j += 1
                    else:
                        # No more payload lines, break
                        break
                
                # Join all payload parts into a single string
                payload = " ".join(payload_parts).strip()
                
                # Update or create node record
                self.update_node(callsign, payload, timestamp, packet_type)
                
                # Continue from where we left off
                i = j
            else:
                i += 1
    
    def update_node(self, callsign: str, payload: str, timestamp: str, packet_type: str):
        """Update or create a node record"""
        if callsign in self.nodes:
            # Update existing record
            self.nodes[callsign].latest_payload = payload
            self.nodes[callsign].last_timestamp = timestamp
            self.nodes[callsign].packet_type = packet_type
        else:
            # Create new record
            self.nodes[callsign] = NodeRecord(
                callsign=callsign,
                latest_payload=payload,
                last_timestamp=timestamp,
                packet_type=packet_type,
                first_seen=timestamp
            )
    
    def parse_file(self, filepath: str):
        """Parse an AX25 log file and update node database"""
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            self.parse_lines(lines)
            self.save_database()
        except Exception as e:
            print(f"Error parsing file {filepath} for node database: {e}")
    
    def get_all_nodes(self, limit: Optional[int] = None, offset: int = 0) -> Dict:
        """Get all nodes with pagination support"""
        sorted_nodes = sorted(
            self.nodes.values(),
            key=lambda x: x.last_timestamp,
            reverse=True
        )
        
        total_count = len(sorted_nodes)
        
        if limit is not None:
            end_idx = offset + limit
            paginated_nodes = sorted_nodes[offset:end_idx]
        else:
            paginated_nodes = sorted_nodes[offset:]
        
        return {
            'nodes': [
                {
                    'callsign': node.callsign,
                    'latest_payload': node.latest_payload,
                    'last_timestamp': node.last_timestamp,
                    'packet_type': node.packet_type,
                    'first_seen': node.first_seen
                }
                for node in paginated_nodes
            ],
            'total_count': total_count,
            'offset': offset,
            'limit': limit
        }
    
    def get_node(self, callsign: str) -> Optional[NodeRecord]:
        """Get a specific node by callsign"""
        return self.nodes.get(callsign)