<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$admin = require_admin();
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? 'list';

try {
    if ($action === 'list') {
        $stmt = db()->query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY id DESC');
        json_response(['ok' => true, 'users' => $stmt->fetchAll()]);
    }

    if ($action === 'update') {
        $id = (int)($input['id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        $phone = trim((string)($input['phone'] ?? ''));
        $role = (string)($input['role'] ?? 'user');

        if ($id <= 0 || $name === '' || !in_array($role, ['user', 'admin'], true)) {
            json_response(['ok' => false, 'message' => 'Invalid user data.'], 422);
        }

        $stmt = db()->prepare('UPDATE users SET name = ?, phone = ?, role = ? WHERE id = ?');
        $stmt->execute([$name, $phone, $role, $id]);
        json_response(['ok' => true, 'message' => 'User updated.']);
    }

    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if ($id === (int)$admin['id']) {
            json_response(['ok' => false, 'message' => 'You cannot delete your own admin account.'], 422);
        }

        $stmt = db()->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        json_response(['ok' => true, 'message' => 'User deleted.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown action.'], 404);
} catch (Throwable $error) {
    json_response(['ok' => false, 'message' => 'Server error: ' . $error->getMessage()], 500);
}
