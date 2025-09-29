# AX25 utilities

# ax25_graph.py

Builds a graph of AX.25 connections from a log file. This allows rebuilding the network topology of an AX25 packet network from a `listen` log.

Examples:

```
python3 ax25_graph.py -i listen-today.log > today-with-hearable.dot
dot -Tpng today-with-hearable.dot -o today-with-hearable.png
sfdp -Goverlap=prism -Gsplines=true -Tpng today-with-hearable.dot -o today-with-hearable.png 
```

# ax25-web

Experimental web interface to display the network topology in those files. Work in progress.

Look at the README.md in that directory for details.
