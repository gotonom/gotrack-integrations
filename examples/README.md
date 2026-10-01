# Examples

Minimal webhook receivers that verify GoTrack's `X-GoTrack-Signature` and print the event. No frameworks, no dependencies.

| Language | File | Run |
|---|---|---|
| Python 3 | [`python/server.py`](python/server.py) | `GOTRACK_WEBHOOK_SECRET=… python server.py` |
| Node.js 18+ | [`node/server.js`](node/server.js) | `GOTRACK_WEBHOOK_SECRET=… node server.js` |
| PHP 7.4+ | [`php/webhook.php`](php/webhook.php) | Serve with your web server; set `GOTRACK_WEBHOOK_SECRET` |

Point a GoTrack webhook (**Settings → Webhooks**) at the URL, press **Test**, and a verified `test` event is printed.
