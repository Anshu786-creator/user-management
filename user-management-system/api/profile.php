<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$user = require_user();
$input = json_decode(file_get_contents('php://input'), true) ?: [];

try {
    $name = trim((string)($input['name'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));
    $password = (string)($input['password'] ?? '');

    if ($name === '') {
        json_response(['ok' => false, 'message' => 'Name is required.'], 422);
    }

    if ($password !== '') {
        if (strlen($password) < 6) {
            json_response(['ok' => false, 'message' => 'New password must be at least 6 characters.'], 422);
        }
        $stmt = db()->prepare('UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?');
        $stmt->execute([$name, $phone, password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    } else {
        $stmt = db()->prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?');
        $stmt->execute([$name, $phone, $user['id']]);
    }

    json_response(['ok' => true, 'message' => 'Profile updated.', 'user' => current_user()]);
} catch (Throwable $error) {
    json_response(['ok' => false, 'message' => 'Server error: ' . $error->getMessage()], 500);
}
