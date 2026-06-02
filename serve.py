#!/usr/bin/env python3
"""Optional local server for OfflineGram.

You do NOT need this — the app runs fine by just opening src/index.html
(or double-clicking play.bat). This is only here if you prefer a real
http://localhost address (some browsers behave slightly differently on
file:// URLs). It serves the src/ folder and never touches the network
beyond your own machine.

Usage:
    python serve.py            # serves on http://localhost:8000
    python serve.py 9000       # pick a different port
"""

import http.server
import os
import socketserver
import sys
import webbrowser

DEFAULT_PORT = 8000


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Ignoring '{sys.argv[1]}' — not a port number. Using {DEFAULT_PORT}.")

    src_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
    os.chdir(src_dir)

    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        url = f"http://localhost:{port}/index.html"
        print(f"OfflineGram is serving {src_dir}")
        print(f"Open {url}  (Ctrl+C to stop)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
