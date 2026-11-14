"""Serve the dashboard and the local transformer from one loopback origin."""
import argparse
import json
import socket
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from .corpus import ROOT
from .engine import Engine, OllamaSelector, ProviderError


class Handler(SimpleHTTPRequestHandler):
    server_version="FirstFire/1"
    def log_message(self,format,*args):
        # Default access logs would retain query strings in GET URLs.
        pass

    def send_json(self,code,data):
        result=json.dumps(data,ensure_ascii=False,separators=(",",":")).encode()
        self.send_response(code);self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(result)));self.end_headers()
        try: self.wfile.write(result)
        except (BrokenPipeError,ConnectionResetError): pass

    def local_host(self):
        valid={f"127.0.0.1:{self.server.server_port}",f"localhost:{self.server.server_port}"}
        return self.headers.get("Host","").lower() in valid

    def do_GET(self):
        if not self.local_host():
            return self.send_json(403,{"error":"Local host required."})
        if urlsplit(self.path).path=="/api/health":
            return self.send_json(200,self.server.engine.health())
        if urlsplit(self.path).path.startswith("/api/"):
            return self.send_json(404,{"error":"Unknown API route."})
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path!="/api/chat":
            return self.send_json(404,{"error":"Unknown API route."})
        if not self.local_host():
            return self.send_json(403,{"error":"Local host required."})
        origin=self.headers.get("Origin")
        if origin and origin!="http://"+self.headers.get("Host",""):
            return self.send_json(403,{"error":"Open the dashboard at this server’s local address."})
        if self.headers.get_content_type()!="application/json":
            return self.send_json(415,{"error":"Send application/json."})
        try:
            count=int(self.headers.get("Content-Length","0"))
            if count<1 or count>240000:
                return self.send_json(413,{"error":"Request body size is outside limits."})
            obj=json.loads(self.rfile.read(count))
            with self.server.lock:
                answer=self.server.engine.answer(obj)
            self.send_json(200,answer)
        except (ValueError,UnicodeError) as e:
            self.send_json(400,{"error":str(e)[:160]})
        except ProviderError as e:
            self.send_json(503,{"error":str(e)})
        except Exception as e:
            print("Chat request failed: "+type(e).__name__,file=sys.stderr)
            self.send_json(500,{"error":"The local chat could not complete this request."})

    def list_directory(self,path):
        return self.send_error(404)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port",type=int,default=8765)
    parser.add_argument("--model",help="an installed local Ollama tag")
    args=parser.parse_args()
    try:
        engine=Engine(OllamaSelector(args.model))
    except (ImportError,OSError) as e:
        sys.exit("The local BGE encoder requires its Python environment and cached weights. Run the setup in chat/README.md. "+str(e))
    server=ThreadingHTTPServer(("127.0.0.1",args.port),partial(Handler,directory=str(ROOT/"dist")))
    server.engine=engine;server.lock=threading.Lock()
    print(f"FIRST FIRE at http://127.0.0.1:{args.port}/#chat | {engine.provider.model} | {len(engine.index.docs)} passages",flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__":
    main()
