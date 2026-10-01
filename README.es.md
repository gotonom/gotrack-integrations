# Integraciones de GoTrack

[English](README.md) · [Türkçe](README.tr.md) · **Español**

Cómo recibir y verificar los eventos de **[GoTrack](https://gotrackgo.com/es/)**, el software de analítica de producto en tienda y pantallas inteligentes de GOTONOM: webhooks firmados, el contenido de cada evento y ejemplos de verificación en Python, Node.js y PHP.

> **¿Qué es GoTrack?** Con sus propias cámaras, colocadas cerca de los productos (las suministra GOTONOM o se compran según sus especificaciones), mide qué productos y colores toman los clientes, cuánto tiempo los sostienen y cuáles devuelven, por producto, zona, hora y tienda. Una pantalla junto al producto puede mostrarlo mientras está en la mano. Las imágenes se procesan en un dispositivo de la tienda y no se guardan por defecto; GoTrack no usa reconocimiento facial. Más: [¿Qué es GoTrack?](https://gotrackgo.com/es/que-es-gotrack)

Ejemplos: [`examples/`](examples/) · JSON Schema: [`schema/events.schema.json`](schema/events.schema.json)

## Configurar un webhook

1. En el panel de GoTrack, abra **Configuración → Webhooks salientes** y añada un destino: un nombre, una URL HTTPS y los eventos que debe recibir.
2. Copie la **clave de firma**. Se muestra una sola vez, al crear el webhook o al renovar la clave.
3. Use **Probar** para enviar un evento `test` y confirmar que su destino lo verifica.

## Eventos

| Evento | Se envía cuando |
|---|---|
| `pickup` | Se toma un producto de un perchero o de una zona del estante. |
| `multiple_pickup` | Reservado. Las versiones actuales envían un `pickup` por producto; si llega este tipo, trátelo como `pickup`. |
| `return` | Un producto tomado vuelve a su sitio. |
| `touch_interaction` | Un cliente toca un producto en una pantalla táctil (solo en tiendas con pantallas táctiles). |
| `screen_paired` | Una pantalla de la tienda se conecta y está lista para mostrar contenido. |
| `screen_offline` | Una pantalla emparejada sigue desconectada después de su periodo de gracia. |
| `test` | Lo envía el botón **Probar**. |

**Hoy no se envían como webhook:** los productos mostrados a la cámara en *modo presentación* (showrooms, ferias). Esas muestras están en los informes y en las exportaciones CSV/PDF de GoTrack.

## Formato de la petición

GoTrack envía un `POST` HTTP con un cuerpo JSON compacto y estas cabeceras:

| Cabecera | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `X-GoTrack-Event` | El tipo de evento, por ejemplo `pickup` |
| `X-GoTrack-Signature` | `sha256=` seguido del HMAC-SHA256 en hexadecimal del **cuerpo sin procesar**, con su clave de firma |
| `User-Agent` | `gotrack-webhook/1` |

## Verificar la firma

Calcule el HMAC-SHA256 sobre los bytes exactos que recibió (no sobre un JSON vuelto a serializar), añada el prefijo `sha256=` y compare en tiempo constante:

```python
import hashlib, hmac

def verify(secret: str, raw_body: bytes, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")
```

Servidores completos: [Python](examples/python/server.py) · [Node.js](examples/node/server.js) · [PHP](examples/php/webhook.php). Si la verificación falla, rechace la petición con `401`.

## Contenido de los eventos

### `pickup`, `return` (y `multiple_pickup`)

```json
{
  "type": "pickup",
  "track_id": 1042,
  "rack_zone": "A",
  "evidence_frames": 6,
  "timestamp": "2026-10-01T13:15:52.410000+00:00",
  "clock_synced": true,
  "variant_id": "6f1c…",
  "product_name": "Camisa de lino",
  "sku": "LS-0412",
  "color": "lavanda",
  "confidence": 0.912,
  "confidence_tier": "HIGH",
  "signage_content_url": "https://…/camisa-de-lino.webp",
  "signage_content_type": "image",
  "metrics": { }
}
```

- `timestamp` es el momento en que ocurrió el evento en la tienda (ISO 8601). `clock_synced` indica si el reloj del dispositivo estaba sincronizado en ese momento: `true`, `false` (la hora puede no ser exacta, por ejemplo justo después de un corte de luz, hasta que el dispositivo se sincronice) o `null` (el dispositivo no pudo saberlo).
- `variant_id`, `product_name`, `sku` y `color` identifican la variante del producto tal como está configurada en el panel.
- `confidence` (0–1) y `confidence_tier` (`HIGH`, `MEDIUM`, `LOW` o `UNKNOWN`) indican la seguridad del reconocimiento.
- `metrics` contiene valores de diagnóstico del evento. Sus campos pueden cambiar entre versiones; no construya sobre ellos.
- `track_id` es un número de corta duración dentro de una cámara. No identifica a nadie y se repite con el tiempo.

### `screen_paired`, `screen_offline`

```json
{
  "type": "screen_offline",
  "screen_id": "tienda-12-muro-calzado",
  "signage_screen_id": "1b9e…",
  "rack_zone": "B",
  "brand_id": "…"
}
```

`rack_zone` es `null` en una pantalla que no está vinculada a una zona.

### `touch_interaction`

```json
{
  "type": "touch_interaction",
  "screen_id": "tienda-12-entrada",
  "signage_screen_id": "1b9e…",
  "brand_id": "…",
  "variant_id": "6f1c…",
  "product_name": "Camisa de lino"
}
```

### `test`

```json
{ "type": "test", "brand_id": "…", "message": "GoTrack webhook test delivery" }
```

Todos los contenidos están descritos en [`schema/events.schema.json`](schema/events.schema.json).

## Comportamiento de entrega

- **Un intento por evento**, con 8 segundos de tiempo de espera (4 s para conectar). Responda `2xx` rápido y haga su trabajo después.
- El estado de cada entrega se registra y se ve en el webhook dentro del panel.
- No hay reintentos; si su destino no puede perder ningún evento, concilie con la exportación CSV.
- La firma no incluye marca de tiempo. Para ignorar una entrega repetida, guarde `(type, track_id, timestamp)` de los eventos recientes.
- Los dispositivos de tienda siguen funcionando sin internet; los eventos registrados durante un corte llegan a la nube de GoTrack, con su hora real, cuando vuelve la conexión ([nota de laboratorio](https://gotrackgo.com/es/prueba-sin-internet)).

## Exportaciones

Cada informe del panel puede exportarse también en **CSV** o **PDF**, por tienda y periodo. No hay un conector listo para ERP, TPV, fidelización o CRM; los webhooks y las exportaciones son los puntos de integración. Para relacionar el interés en el estante con las ventas, combine estas exportaciones con sus propios datos de ventas.

## Acerca de

GoTrack lo desarrolla [GOTONOM Yazılım Teknolojileri A.Ş.](https://gotonom.com), en Estambul.
Sitio web: [gotrackgo.com/es](https://gotrackgo.com/es/) · Contacto: info@gotonom.com

GoTrack de GOTONOM es software para retail. No tiene relación con rastreadores de vehículos, flotas o GPS, apps de seguimiento de paquetes, sistemas de guiado de tractores ni el proyecto de investigación en visión por computador con el mismo nombre.

El código de ejemplo de este repositorio tiene licencia MIT.
