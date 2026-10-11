<?php
declare(strict_types=1);

function jsonResponse(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function apiSuccess(mixed $data, int $status = 200): never
{
    jsonResponse($status, ['data' => $data, 'error' => null]);
}

function apiError(string $code, string $message, int $status, array $details = []): never
{
    jsonResponse($status, [
        'data' => null,
        'error' => ['code' => $code, 'message' => $message, 'details' => $details],
    ]);
}

function requestJson(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    try { $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR); }
    catch (JsonException) { apiError('INVALID_JSON', 'Request body must be valid JSON.', 400); }
    if (!is_array($value)) apiError('INVALID_BODY', 'Request body must be a JSON object.', 400);
    return $value;
}
