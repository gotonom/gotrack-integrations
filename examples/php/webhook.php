<?php
// Receive and verify GoTrack webhooks — plain PHP.
// Set GOTRACK_WEBHOOK_SECRET in the server environment and point the
// webhook URL at this file.

$secret = getenv('GOTRACK_WEBHOOK_SECRET');
$raw = file_get_contents('php://input');              // the RAW body, not $_POST
$header = $_SERVER['HTTP_X_GOTRACK_SIGNATURE'] ?? '';

// `X-GoTrack-Signature` is 'sha256=' + hex HMAC-SHA256 of the raw body.
$expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
if (!hash_equals($expected, $header)) {
    http_response_code(401);
    exit;
}

$event = json_decode($raw, true);
http_response_code(204);                               // answer quickly

if (in_array($event['type'], ['pickup', 'multiple_pickup'], true)) {
    error_log("{$event['timestamp']} picked up {$event['product_name']} ({$event['color']}) in zone {$event['rack_zone']}");
} elseif ($event['type'] === 'return') {
    error_log("{$event['timestamp']} put back {$event['product_name']}");
}
