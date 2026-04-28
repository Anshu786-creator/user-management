<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'user_management_app';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    return $pdo;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function current_user(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        json_response(['ok' => false, 'message' => 'Please login first.'], 401);
    }

    return $user;
}

function require_admin(): array
{
    $user = require_user();
    if ($user['role'] !== 'admin') {
        json_response(['ok' => false, 'message' => 'Admin access required.'], 403);
    }

    return $user;
}
