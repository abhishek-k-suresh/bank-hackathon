#!/usr/bin/env python3
"""Static dev server for app/ that disables browser caching.
Usage: python serve_nocache.py [port]   (default 8080)
"""
import http.server, socketserver, sys, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", port), NoCacheHandler) as httpd:
    print(f"Serving app/ (no-cache) on http://localhost:{port}")
    httpd.serve_forever()
