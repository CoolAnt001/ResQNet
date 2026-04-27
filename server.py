import http.server
import socketserver
import json
import threading
import time
import os
import uuid

PORT = 8080
INTEL_DIR = "intel"
if not os.path.exists(INTEL_DIR):
    os.makedirs(INTEL_DIR)

active_nodes = {}  # {node_id: last_seen_timestamp}
nodes_lock = threading.Lock()
alert_history = [] # Rolling list of recent broadcasts
alerts_lock = threading.Lock()

TIMEOUT_SECONDS = 120  # 2 minutes

class MeshHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        # Print every request to the terminal for tactical debugging
        print(f"[TACTICAL LINK] {args[0]} {args[1]}", flush=True)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        try:
            data = json.loads(post_data.decode('utf-8'))
        except:
            data = {}

        if self.path == '/broadcast':
            with alerts_lock:
                # Add unique arrival timestamp for client-side filtering
                data['received_at'] = time.time()
                alert_history.append(data)
                # Keep only last 50 alerts
                if len(alert_history) > 50:
                    alert_history.pop(0)
            self._json_response({'status': 'ok'})

        elif self.path == '/register':
            node_id = data.get('node_id', 'unknown')
            with nodes_lock:
                active_nodes[node_id] = time.time()
                count = len(active_nodes)
            print(f"[DEBUG] NEW REGISTRATION: {node_id} | Total unique: {count}", flush=True)
            self._json_response({'count': count})

        elif self.path == '/unregister':
            node_id = data.get('node_id', 'unknown')
            with nodes_lock:
                if node_id in active_nodes:
                    del active_nodes[node_id]
                count = len(active_nodes)
            print(f"[DEBUG] UNREGISTERED: {node_id} | Total unique: {count}", flush=True)
            self._json_response({'count': count})

        elif self.path.startswith('/upload_intel'):
            node_id = 'unknown'
            if '?' in self.path:
                params = self.path.split('?')[1]
                for p in params.split('&'):
                    if p.startswith('node_id='):
                        node_id = p.split('=')[1]
            
            timestamp = int(time.time() * 1000)
            unique_id = uuid.uuid4().hex[:6]
            filename = os.path.join(INTEL_DIR, f"intel_{node_id}_{timestamp}_{unique_id}.webm")
            try:
                with open(filename, "wb") as f:
                    f.write(post_data)
                self._json_response({'status': 'captured', 'path': filename})
            except Exception as e:
                print(f"[ERROR] Failed to save intel: {e}", flush=True)
                self.send_error(500, "Internal Server Error")

    def do_GET(self):
        if self.path.startswith('/node_count'):
            global active_nodes
            node_id = 'unknown'
            if '?' in self.path:
                query = self.path.split('?')[1]
                for part in query.split('&'):
                    if part.startswith('node_id='):
                        node_id = part.split('=')[1]

            with nodes_lock:
                if node_id != 'unknown':
                    active_nodes[node_id] = time.time()
                
                # Aggressive Pruning
                now = time.time()
                active_nodes = {nid: last for nid, last in active_nodes.items() if now - last < TIMEOUT_SECONDS}
                
                count = len(active_nodes)
            self._json_response({'count': count})

        elif self.path == '/poll_alerts':
            with alerts_lock:
                # Return all current alerts in history. Clients will filter.
                response_alerts = list(alert_history)
            self._json_response(response_alerts)

        elif self.path.startswith('/list_intel'):
            node_id = None
            if '?' in self.path:
                params = self.path.split('?')[1]
                for p in params.split('&'):
                    if p.startswith('node_id='):
                        node_id = p.split('=')[1]
            
            files = os.listdir(INTEL_DIR)
            if node_id:
                # Filter files for specific node
                files = [f for f in files if f.startswith(f"intel_{node_id}_")]
            
            # Sort by timestamp (descending)
            files.sort(key=lambda x: os.path.getmtime(os.path.join(INTEL_DIR, x)), reverse=True)
            self._json_response({'files': files})

        else:
            return super().do_GET()

    def _json_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Silence verbose request logs

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == "__main__":
    with ThreadedHTTPServer(("", PORT), MeshHandler) as httpd:
        print(f"Emergency Mesh Relay running on port {PORT}", flush=True)
        httpd.serve_forever()
