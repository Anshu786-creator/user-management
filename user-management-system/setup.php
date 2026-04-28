<?php
declare(strict_types=1);

$host = '127.0.0.1';
$dbName = 'user_management_app';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbName`");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            phone VARCHAR(30) DEFAULT '',
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute(['admin@example.com']);

    if (!$stmt->fetch()) {
        $insert = $pdo->prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)');
        $insert->execute([
            'System Admin',
            'admin@example.com',
            '9999999999',
            password_hash('admin123', PASSWORD_DEFAULT),
            'admin',
        ]);
    }

    echo '<h2>Setup complete</h2>';
    echo '<p>Database and users table are ready.</p>';
    echo '<p>Admin login: <strong>admin@example.com</strong> / <strong>admin123</strong></p>';
    echo '<p><a href="index.html">Open website</a></p>';
} catch (Throwable $error) {
    http_response_code(500);
    echo '<h2>Setup failed</h2>';
    echo '<pre>' . htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre>';
}
