<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? '';

try {
    if ($action === 'register') {
        $name = trim((string)($input['name'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $phone = trim((string)($input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            json_response(['ok' => false, 'message' => 'Enter a name, valid email, and password with at least 6 characters.'], 422);
        }

        $stmt = db()->prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $phone, password_hash($password, PASSWORD_DEFAULT)]);

        json_response(['ok' => true, 'message' => 'Registration successful. Please login.']);
    }

    if ($action === 'login') {
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        $stmt = db()->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_response(['ok' => false, 'message' => 'Invalid email or password.'], 401);
        }

        $_SESSION['user_id'] = (int)$user['id'];
        json_response(['ok' => true, 'message' => 'Login successful.', 'user' => current_user()]);
    }

    if ($action === 'me') {
        json_response(['ok' => true, 'user' => current_user()]);
    }

    if ($action === 'logout') {
        session_destroy();
        json_response(['ok' => true, 'message' => 'Logged out.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown action.'], 404);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        json_response(['ok' => false, 'message' => 'Email already registered.'], 409);
    }
    json_response(['ok' => false, 'message' => 'Server error: ' . $error->getMessage()], 500);
}
