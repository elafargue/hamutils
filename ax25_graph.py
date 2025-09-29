#!/usr/bin/env python3
"""
ax25_graph.py — parse AX.25 `listen` logs (with or without syslog prefixes)
and output a hearing graph (DOT/Mermaid/edges).

Key behaviors:
- Finds "fm <SRC> to <DST> via ..." anywhere in the line (syslog-safe).
- VIA capture ends at 'ctl', 'pid=', 'len', or end-of-line.
- For each starred hop X* we add X -> nextHop.
- Optional: add SRC -> firstStarredHop with --include-origins.
- Optional: show all calls (including leaf/isolated) with --emit-isolated.

Usage:
  python ax25_graph.py -i listen.log > graph.dot
  dot -Tpng graph.dot -o graph.png
"""

import argparse
import re
import sys
from collections import defaultdict

# Match "fm <SRC> to <DST>" anywhere (syslog-safe)
SRC_RE = re.compile(r"\bfm\s+(\S+)\s+to\s+\S+", re.IGNORECASE)

# Capture everything after "via" up to 'ctl' or 'pid=' or 'len' or EOL
# Works whether the line starts with syslog prefix or not.
VIA_RE = re.compile(r"\bvia\b(.*?)(?=\bctl\b|\bpid\s*=\b|\blen\b|$)", re.IGNORECASE)

def strip_ssid(call: str, keep: bool) -> str:
    if keep:
        return call
    return call.split('-', 1)[0]

def tokenize_path(path_segment: str):
    # Split by whitespace and strip trailing punctuation/markers
    raw = path_segment.strip().split()
    tokens = []
    for t in raw:
        t = t.strip().strip(",;:/()[]{}")
        if t:
            tokens.append(t)
    return tokens

def parse_graph(lines, keep_ssid=False, include_origins=False):
    """
    Returns:
      edges: set[(a,b)]
      counts: dict[(a,b)] -> int
      nodes_all: set[str] of every callsign seen (SRC + VIA tokens)
    """
    edges = set()
    counts = defaultdict(int)
    nodes_all = set()

    for line in lines:
        # Ensure we're operating on a plain str
        if not isinstance(line, str):
            try:
                line = line.decode("utf-8", "ignore")
            except Exception:
                continue

        # Source (leaf station)
        src = None
        msrc = SRC_RE.search(line)
        if msrc:
            src = strip_ssid(msrc.group(1), keep_ssid)
            if src:
                nodes_all.add(src)

        # VIA path
        mvia = VIA_RE.search(line)
        if not mvia:
            continue

        tokens = tokenize_path(mvia.group(1))
        # Track all VIA tokens as nodes (with stars removed)
        cleaned = [strip_ssid(tok.replace("*", ""), keep_ssid) for tok in tokens]
        for c in cleaned:
            if c:
                nodes_all.add(c)

        # Build hop->next edges for each starred hop
        first_star_idx = None
        for i, tok in enumerate(tokens):
            starred = "*" in tok
            if starred and first_star_idx is None:
                first_star_idx = i
            if starred and i + 1 < len(tokens):
                a = strip_ssid(tok.replace("*", ""), keep_ssid)
                b = strip_ssid(tokens[i+1].replace("*", ""), keep_ssid)
                if a and b and a != b:
                    edges.add((a, b))
                    counts[(a, b)] += 1

        # Optional origin edge: SRC -> first starred hop
        if include_origins and src and first_star_idx is not None:
            first_star = strip_ssid(tokens[first_star_idx].replace("*", ""), keep_ssid)
            if first_star and src != first_star:
                edges.add((src, first_star))
                counts[(src, first_star)] += 1

    return edges, counts, nodes_all

def emit_dot(edges, counts, nodes_all=None, directed=False, emit_isolated=False, out=sys.stdout):
    gtype = "digraph" if directed else "graph"
    conn = "->" if directed else "--"
    print(f"{gtype} G {{", file=out)
    print('  graph [overlap=false, splines=true];', file=out)
    print('  node [shape=ellipse, style=filled, fillcolor="#e6f2ff"];', file=out)

    nodes_from_edges = set()
    for a, b in edges:
        nodes_from_edges.add(a); nodes_from_edges.add(b)
    nodes = set(nodes_from_edges)
    if emit_isolated and nodes_all:
        nodes |= set(nodes_all)

    for n in sorted(nodes):
        print(f'  "{n}";', file=out)

    for (a, b) in sorted(edges):
        label = counts.get((a, b), 1)
        print(f'  "{a}" {conn} "{b}" [label="{label}"];', file=out)
    print("}", file=out)

def emit_mermaid(edges, counts, nodes_all=None, directed=False, emit_isolated=False, out=sys.stdout):
    arrow = "-->" if directed else "---"
    print("flowchart LR", file=out)

    nodes_from_edges = set()
    for a, b in edges:
        nodes_from_edges.add(a); nodes_from_edges.add(b)
    nodes = set(nodes_from_edges)
    if emit_isolated and nodes_all:
        nodes |= set(nodes_all)

    for n in sorted(nodes):
        safe = n.replace('-', '_')
        print(f'  {safe}["{n}"]', file=out)

    for (a, b) in sorted(edges):
        label = counts.get((a, b), 1)
        sa = a.replace('-', '_'); sb = b.replace('-', '_')
        print(f'  {sa} {arrow} |{label}| {sb}', file=out)

def emit_edges_tsv(edges, counts, nodes_all=None, emit_isolated=False, out=sys.stdout):
    print("from\tto\tcount", file=out)
    for (a, b) in sorted(edges):
        print(f"{a}\t{b}\t{counts.get((a, b), 1)}", file=out)
    if emit_isolated and nodes_all:
        isolated = set(nodes_all)
        for a, b in edges:
            isolated.discard(a); isolated.discard(b)
        for n in sorted(isolated):
            print(f"{n}\t\t0", file=out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-i", "--input", help="log file (default: stdin)")
    ap.add_argument("--format", choices=["dot", "mermaid", "edges"], default="dot")
    ap.add_argument("--directed", action="store_true", help="emit directed graph")
    ap.add_argument("--keep-ssid", action="store_true", help="keep CALL-SSID")
    ap.add_argument("--include-origins", action="store_true",
                    help="add SRC -> firstStarredHop edges")
    ap.add_argument("--emit-isolated", action="store_true",
                    help="show all calls seen even if they have no edges")
    args = ap.parse_args()

    lines = sys.stdin.readlines() if not args.input else open(args.input, "r", encoding="utf-8", errors="ignore").readlines()

    edges, counts, nodes_all = parse_graph(
        lines,
        keep_ssid=args.keep_ssid,
        include_origins=args.include_origins
    )

    if args.format == "dot":
        emit_dot(edges, counts, nodes_all, directed=args.directed, emit_isolated=args.emit_isolated)
    elif args.format == "mermaid":
        emit_mermaid(edges, counts, nodes_all, directed=args.directed, emit_isolated=args.emit_isolated)
    else:
        emit_edges_tsv(edges, counts, nodes_all, emit_isolated=args.emit_isolated)

if __name__ == "__main__":
    main()
