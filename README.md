# GoTrack integrations

**English** · [Türkçe](README.tr.md) · [Español](README.es.md)

How to receive and verify events from **[GoTrack](https://gotrackgo.com)**, GOTONOM's in-store product analytics and smart-screen software: signed webhooks, the event payloads, and verification examples in Python, Node.js and PHP.

> **What is GoTrack?** Using its own cameras, placed close to the products (supplied by GOTONOM or bought to its specification), GoTrack measures which products and colours shoppers pick up, how long they hold them and which they put back, per product, zone, hour and store. A screen beside the shelf can show the product in hand. Images are processed on a device in the store and are not stored by default; GoTrack uses no face recognition. More: [What is GoTrack?](https://gotrackgo.com/en/what-is-gotrack) · [GoTrack nedir?](https://gotrackgo.com/tr/gotrack-nedir)

## Contents

- [Set up a webhook](#set-up-a-webhook)
- [Events](#events)
- [Request format](#request-format)
- [Verify the signature](#verify-the-signature)
- [Payloads](#payloads)
- [Delivery behaviour](#delivery-behaviour)
- [Exports](#exports)
- [Examples](examples/) · [JSON Schema](schema/events.schema.json)

## Set up a webhook

1. In the GoTrack panel, open **Settings → Webhooks** and add an endpoint: a name, an HTTPS URL, and the events it should receive.
2. Copy the **signing secret**. It is shown once, when the webhook is created or its secret is rotated.
3. Use **Test** to send a `test` event and confirm your endpoint verifies it.

## Events

| Event | Sent when |
|---|---|
| `pickup` | A product is taken from a rack or shelf zone. |
| `multiple_pickup` | Reserved. Current versions send one `pickup` per product; if this type arrives, treat it like `pickup`. |
| `return` | A picked-up product goes back to its place. |
| `touch_interaction` | A shopper taps a product on a touch screen (only for stores using touch screens). |
| `screen_paired` | A store screen connects and is ready to show content. |
| `screen_offline` | A paired screen has stayed disconnected past its grace period. |
| `test` | Sent by the **Test** button. |

**Not sent as webhooks today:** products held up to the camera in *presentation mode* (showrooms, fairs). Those showings are in GoTrack's reports and CSV/PDF exports.

## Request format

GoTrack sends an HTTP `POST` with a compact JSON body and these headers:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-GoTrack-Event` | The event type, e.g. `pickup` |
| `X-GoTrack-Signature` | `sha256=` followed by the hex HMAC-SHA256 of the **raw request body**, keyed with your signing secret |
| `User-Agent` | `gotrack-webhook/1` |

## Verify the signature

Compute HMAC-SHA256 over the exact bytes you received (not a re-serialised JSON object), prefix `sha256=`, and compare in constant time:

```python
import hashlib, hmac

def verify(secret: str, raw_body: bytes, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")
```

Full servers: [Python](examples/python/server.py) · [Node.js](examples/node/server.js) · [PHP](examples/php/webhook.php). Reject the request with `401` when verification fails.

## Payloads

### `pickup`, `return` (and `multiple_pickup`)

```json
{
  "type": "pickup",
  "track_id": 1042,
  "rack_zone": "A",
  "evidence_frames": 6,
  "timestamp": "2026-10-01T13:15:52.410000+00:00",
  "clock_synced": true,
  "variant_id": "6f1c…",
  "product_name": "Linen shirt",
  "sku": "LS-0412",
  "color": "lavender",
  "confidence": 0.912,
  "confidence_tier": "HIGH",
  "signage_content_url": "https://…/linen-shirt.webp",
  "signage_content_type": "image",
  "metrics": { }
}
```

- `timestamp` is when the event happened in the store (ISO 8601). `clock_synced` says whether the store device's clock was synchronised at that moment: `true`, `false` (the time may be off, for example right after a power cut, until the device syncs), or `null` (the device could not tell).
- `variant_id`, `product_name`, `sku` and `color` identify the product variant as set up in the panel.
- `confidence` (0–1) and `confidence_tier` (`HIGH`, `MEDIUM`, `LOW` or `UNKNOWN`) say how sure the recognition was.
- `metrics` holds diagnostic values about the event. Its fields can change between versions; don't build on them.
- `track_id` is a short-lived number within one camera. It identifies no one and repeats over time.

### `screen_paired`, `screen_offline`

```json
{
  "type": "screen_offline",
  "screen_id": "store-12-shoe-wall",
  "signage_screen_id": "1b9e…",
  "rack_zone": "B",
  "brand_id": "…"
}
```

`rack_zone` is `null` for a screen not bound to a zone.

### `touch_interaction`

```json
{
  "type": "touch_interaction",
  "screen_id": "store-12-lobby",
  "signage_screen_id": "1b9e…",
  "brand_id": "…",
  "variant_id": "6f1c…",
  "product_name": "Linen shirt"
}
```

### `test`

```json
{ "type": "test", "brand_id": "…", "message": "GoTrack webhook test delivery" }
```

All payloads are described in [`schema/events.schema.json`](schema/events.schema.json).

## Delivery behaviour

- **One attempt per event**, with an 8-second timeout (4 s to connect). Answer `2xx` quickly and do your work afterwards.
- Each delivery's status is recorded and visible on the webhook in the panel.
- There is no retry; if your endpoint must not miss an event, reconcile with the CSV export.
- The signature has no timestamp. To ignore a repeated delivery, keep the `(type, track_id, timestamp)` of recent events.
- Store devices keep working without internet; events recorded during an outage reach GoTrack's cloud, with their real times, when the connection returns ([lab note](https://gotrackgo.com/en/offline-test)).

## Exports

Every report in the panel can also be exported as **CSV** or **PDF**, per store and period. There is no ready-made ERP, POS, loyalty or CRM connector; webhooks and exports are the integration points. To relate shelf interest to sales, join these exports with your own sales data.

## About

GoTrack is made by [GOTONOM Yazılım Teknolojileri A.Ş.](https://gotonom.com), İstanbul.
Website: [gotrackgo.com](https://gotrackgo.com) (Türkçe) · [English](https://gotrackgo.com/en/) · [Español](https://gotrackgo.com/es/) · Contact: info@gotonom.com

GoTrack by GOTONOM is retail software. It is not related to vehicle, fleet or GPS trackers, parcel tracking apps, tractor guidance systems, or the computer-vision research project of the same name.

The example code in this repository is MIT-licensed.
