"""Boyd Family Escape Room server on 127.0.0.1:4352 (stdlib)."""
import http.server, os, socketserver
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("ER_PORT", "4352"))
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/healthz":
            return self._send(200, b'{"ok":true}', "application/json")
        rel = {"/": "dist/escape-room.html", "/index.html": "dist/escape-room.html",
               "/escape-room.html": "dist/escape-room.html"}.get(p)
        if not rel:
            # allow serving web/ during dev
            if p.startswith("/web/"):
                rel = p.lstrip("/")
            else:
                return self._send(404, b"not found", "text/plain")
        path = os.path.join(HERE, rel)
        if not os.path.isfile(path):
            return self._send(404, b"not found", "text/plain")
        data = open(path, "rb").read()
        ct = "text/html; charset=utf-8"
        if path.endswith(".css"): ct = "text/css; charset=utf-8"
        elif path.endswith(".js"): ct = "application/javascript; charset=utf-8"
        self._send(200, data, ct)
    def _send(self, code, body, ct):
        self.send_response(code)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
if __name__ == "__main__":
    print(f"Escape Room on http://127.0.0.1:{PORT}", flush=True)
    S(("127.0.0.1", PORT), H).serve_forever()
