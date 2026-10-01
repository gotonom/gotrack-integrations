# GoTrack entegrasyonları

[English](README.md) · **Türkçe** · [Español](README.es.md)

GOTONOM'un mağaza içi ürün analitiği ve akıllı ekran yazılımı **[GoTrack](https://gotrackgo.com)**'ten olayları almak ve doğrulamak için: imzalı webhook'lar, olay içerikleri ve Python, Node.js ve PHP ile doğrulama örnekleri.

> **GoTrack nedir?** Mağazanın kendi kameralarıyla, müşterilerin hangi ürün ve rengi raftan aldığını, ne kadar elde tuttuğunu ve hangilerini geri bıraktığını ürün, bölge, saat ve mağaza bazında ölçer. Ürünün yanındaki ekran, ürün eldeyken onu gösterebilir. Görüntü mağazadaki bir cihazda işlenir ve varsayılan olarak saklanmaz; GoTrack yüz tanıma kullanmaz. Daha fazlası: [GoTrack nedir?](https://gotrackgo.com/tr/gotrack-nedir)

Örnekler: [`examples/`](examples/) · JSON Schema: [`schema/events.schema.json`](schema/events.schema.json)

## Webhook kurulumu

1. GoTrack panelinde **Ayarlar → Giden webhook'lar** bölümünü açın ve bir uç nokta ekleyin: bir ad, bir HTTPS adresi ve alacağı olaylar.
2. **İmza anahtarını** kopyalayın. Yalnızca webhook oluşturulurken ya da anahtarı yenilendiğinde bir kez gösterilir.
3. **Test et** ile bir `test` olayı gönderin ve uç noktanızın onu doğruladığını görün.

## Olaylar

| Olay | Ne zaman gönderilir |
|---|---|
| `pickup` | Bir ürün raftan veya raf bölgesinden alındığında. |
| `multiple_pickup` | Ayrılmış. Güncel sürümler her ürün için ayrı bir `pickup` gönderir; bu tür gelirse `pickup` gibi işleyin. |
| `return` | Alınan bir ürün yerine geri konduğunda. |
| `touch_interaction` | Müşteri dokunmatik bir ekranda bir ürüne dokunduğunda (yalnızca dokunmatik ekran kullanan mağazalarda). |
| `screen_paired` | Bir mağaza ekranı bağlanıp içerik göstermeye hazır olduğunda. |
| `screen_offline` | Eşleşmiş bir ekran bekleme süresinden sonra da bağlantısız kaldığında. |
| `test` | **Test et** düğmesiyle gönderilir. |

**Bugün webhook olarak gönderilmeyenler:** *sunum modunda* (showroom, fuar) kameraya gösterilen ürünler. Bu gösterimler GoTrack raporlarında ve CSV/PDF dışa aktarımlarında yer alır.

## İstek biçimi

GoTrack, sıkıştırılmış bir JSON gövdesiyle HTTP `POST` gönderir ve şu başlıkları ekler:

| Başlık | Değer |
|---|---|
| `Content-Type` | `application/json` |
| `X-GoTrack-Event` | Olay türü, örneğin `pickup` |
| `X-GoTrack-Signature` | `sha256=` ve ardından, imza anahtarınızla hesaplanmış **ham istek gövdesinin** hex HMAC-SHA256 değeri |
| `User-Agent` | `gotrack-webhook/1` |

## İmzayı doğrulama

HMAC-SHA256'yı aldığınız baytların tam kendisi üzerinden hesaplayın (yeniden serileştirilmiş bir JSON nesnesi üzerinden değil), başına `sha256=` ekleyin ve sabit sürede karşılaştırın:

```python
import hashlib, hmac

def verify(secret: str, raw_body: bytes, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")
```

Tam sunucular: [Python](examples/python/server.py) · [Node.js](examples/node/server.js) · [PHP](examples/php/webhook.php). Doğrulama başarısızsa isteği `401` ile reddedin.

## Olay içerikleri

### `pickup`, `return` (ve `multiple_pickup`)

```json
{
  "type": "pickup",
  "track_id": 1042,
  "rack_zone": "A",
  "evidence_frames": 6,
  "timestamp": "2026-10-01T13:15:52.410000+00:00",
  "clock_synced": true,
  "variant_id": "6f1c…",
  "product_name": "Keten gömlek",
  "sku": "LS-0412",
  "color": "lila",
  "confidence": 0.912,
  "confidence_tier": "HIGH",
  "signage_content_url": "https://…/keten-gomlek.webp",
  "signage_content_type": "image",
  "metrics": { }
}
```

- `timestamp`, olayın mağazada gerçekleştiği andır (ISO 8601). `clock_synced`, mağaza cihazının saatinin o anda eşitlenmiş olup olmadığını söyler: `true`, `false` (saat, örneğin bir elektrik kesintisinden hemen sonra, cihaz eşitlenene kadar kayık olabilir) ya da `null` (cihaz bunu bilemedi).
- `variant_id`, `product_name`, `sku` ve `color`, panelde tanımlandığı şekliyle ürün varyantını belirtir.
- `confidence` (0–1) ve `confidence_tier` (`HIGH`, `MEDIUM`, `LOW` veya `UNKNOWN`) tanımanın ne kadar emin olduğunu söyler.
- `metrics`, olayla ilgili tanı değerlerini taşır. Alanları sürümler arasında değişebilir; bunlara dayalı geliştirme yapmayın.
- `track_id`, tek bir kamera içindeki kısa ömürlü bir numaradır. Kimseyi tanımlamaz ve zamanla tekrarlanır.

### `screen_paired`, `screen_offline`

```json
{
  "type": "screen_offline",
  "screen_id": "magaza-12-ayakkabi-duvari",
  "signage_screen_id": "1b9e…",
  "rack_zone": "B",
  "brand_id": "…"
}
```

Bir bölgeye bağlı olmayan ekranlarda `rack_zone` değeri `null` olur.

### `touch_interaction`

```json
{
  "type": "touch_interaction",
  "screen_id": "magaza-12-giris",
  "signage_screen_id": "1b9e…",
  "brand_id": "…",
  "variant_id": "6f1c…",
  "product_name": "Keten gömlek"
}
```

### `test`

```json
{ "type": "test", "brand_id": "…", "message": "GoTrack webhook test delivery" }
```

Tüm içerikler [`schema/events.schema.json`](schema/events.schema.json) dosyasında tanımlıdır.

## Teslim davranışı

- **Olay başına tek deneme**, 8 saniyelik zaman aşımıyla (bağlantı için 4 sn). Hızlıca `2xx` yanıt verin, işinizi sonra yapın.
- Her teslimin durumu kaydedilir ve paneldeki webhook üzerinde görünür.
- Yeniden deneme yoktur; uç noktanız hiçbir olayı kaçırmamalıysa CSV dışa aktarımıyla mutabakat yapın.
- İmza bir zaman damgası içermez. Tekrarlanan bir teslimi yok saymak için son olayların `(type, track_id, timestamp)` değerlerini saklayın.
- Mağaza cihazları internetsiz de çalışır; kesinti sırasında kaydedilen olaylar bağlantı geri geldiğinde, gerçek zamanlarıyla GoTrack bulutuna ulaşır ([laboratuvar notu](https://gotrackgo.com/tr/internetsiz-calisma-testi)).

## Dışa aktarımlar

Paneldeki her rapor, mağaza ve dönem bazında **CSV** veya **PDF** olarak da dışa aktarılabilir. Hazır bir ERP, POS, sadakat veya CRM bağlayıcısı yoktur; entegrasyon noktaları webhook'lar ve dışa aktarımlardır. Raftaki ilgiyi satışla ilişkilendirmek için bu dışa aktarımları kendi satış verinizle birleştirin.

## Hakkında

GoTrack, İstanbul'da [GOTONOM Yazılım Teknolojileri A.Ş.](https://gotonom.com) tarafından geliştirilir.
Web sitesi: [gotrackgo.com](https://gotrackgo.com) · İletişim: info@gotonom.com

GOTONOM'un GoTrack'i perakende yazılımıdır. Aynı adı taşıyan araç, filo veya GPS takip ürünleri, kargo takip uygulamaları, traktör yönlendirme sistemleri ya da bilgisayarlı görü araştırma projesiyle ilgisi yoktur.

Bu depodaki örnek kodlar MIT lisanslıdır.
