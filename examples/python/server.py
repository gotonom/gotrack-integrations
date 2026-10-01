"""Receive and verify GoTrack webhooks — Python standard library only.

    GOTRACK_WEBHOOK_SECRET=... python server.py      # listens on :8080
"""
import hashlib
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.environ["GOTRACK_WEBHOOK_SECRET"].encode()


def verify(raw_body: bytes, signature_header: str) -> bool:
    """`X-GoTrack-Signature` is 'sha256=' + hex HMAC-SHA256 of the raw body."""
    expected = "sha256=" + hmac.new(SECRET, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not verify(raw, self.headers.get("X-GoTrack-Signature", "")):
            self.send_response(401)
            self.end_headers()
            return
        event = json.loads(raw)
        # Answer first, work afterwards: GoTrack waits at most 8 seconds.
        self.send_response(204)
        self.end_headers()
        if event["type"] in ("pickup", "multiple_pickup"):
            print(f'{event["timestamp"]} picked up {event.get("product_name")} '
                  f'({event.get("color")}) in zone {event.get("rack_zone")}')
        elif event["type"] == "return":
            print(f'{event["timestamp"]} put back {event.get("product_name")}')
        else:
            print(event["type"], event)


if __name__ == "__main__":
    HTTPServer(("", 8080), Handler).serve_forever()
