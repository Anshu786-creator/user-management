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
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            asset_type ENUM('computer', 'printer') NOT NULL,
            asset_tag VARCHAR(80) NOT NULL UNIQUE,
            brand VARCHAR(120) DEFAULT '',
            model VARCHAR(120) DEFAULT '',
            serial_number VARCHAR(120) DEFAULT '',
            location VARCHAR(120) DEFAULT '',
            department VARCHAR(120) DEFAULT '',
            assigned_to VARCHAR(120) DEFAULT '',
            assigned_user_id INT NULL,
            status ENUM('active', 'repair', 'retired') NOT NULL DEFAULT 'active',
            processor VARCHAR(120) DEFAULT '',
            ram VARCHAR(80) DEFAULT '',
            storage VARCHAR(120) DEFAULT '',
            operating_system VARCHAR(120) DEFAULT '',
            ip_address VARCHAR(60) DEFAULT '',
            mac_address VARCHAR(60) DEFAULT '',
            printer_type VARCHAR(120) DEFAULT '',
            connectivity VARCHAR(120) DEFAULT '',
            toner_model VARCHAR(120) DEFAULT '',
            notes TEXT,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_asset_type (asset_type),
            INDEX idx_status (status),
            CONSTRAINT fk_inventory_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_inventory_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    try {
        $pdo->exec("ALTER TABLE inventory_items ADD COLUMN assigned_user_id INT NULL AFTER assigned_to");
        $pdo->exec("ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL");
    } catch (Throwable $ignored) {
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            asset_type ENUM('computer', 'printer') NOT NULL,
            asset_tag VARCHAR(80) NOT NULL,
            brand VARCHAR(120) DEFAULT '',
            model VARCHAR(120) DEFAULT '',
            serial_number VARCHAR(120) DEFAULT '',
            location VARCHAR(120) DEFAULT '',
            department VARCHAR(120) DEFAULT '',
            assigned_to VARCHAR(120) DEFAULT '',
            status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            asset_status ENUM('active', 'repair', 'retired') NOT NULL DEFAULT 'active',
            processor VARCHAR(120) DEFAULT '',
            ram VARCHAR(80) DEFAULT '',
            storage VARCHAR(120) DEFAULT '',
            operating_system VARCHAR(120) DEFAULT '',
            ip_address VARCHAR(60) DEFAULT '',
            mac_address VARCHAR(60) DEFAULT '',
            printer_type VARCHAR(120) DEFAULT '',
            connectivity VARCHAR(120) DEFAULT '',
            toner_model VARCHAR(120) DEFAULT '',
            notes TEXT,
            requested_by INT NULL,
            reviewed_by INT NULL,
            reviewed_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_request_status (status),
            INDEX idx_request_type (asset_type),
            CONSTRAINT fk_inventory_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_inventory_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    try {
        $pdo->exec("ALTER TABLE inventory_requests ADD COLUMN asset_status ENUM('active', 'repair', 'retired') NOT NULL DEFAULT 'active' AFTER status");
    } catch (Throwable $ignored) {
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inventory_item_id INT NOT NULL,
            assignment_action ENUM('allot', 'transfer') NOT NULL,
            from_assigned_to VARCHAR(120) DEFAULT '',
            to_assigned_to VARCHAR(120) NOT NULL,
            from_user_id INT NULL,
            to_user_id INT NULL,
            note VARCHAR(255) DEFAULT '',
            assigned_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_assignment_item (inventory_item_id),
            CONSTRAINT fk_assignment_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
            CONSTRAINT fk_assignment_from_user FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_assignment_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_assignment_admin FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS master_options (
            id INT AUTO_INCREMENT PRIMARY KEY,
            field_name VARCHAR(80) NOT NULL,
            option_value VARCHAR(120) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_master_option (field_name, option_value)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $defaultOptions = [
        'asset_type' => ['computer', 'printer'],
        'status' => ['active', 'repair', 'retired'],
        'department' => ['IT', 'Accounts', 'HR', 'Admin'],
        'location' => ['Server Room', 'IT Room', 'Front Office'],
        'printer_type' => ['Laser', 'Inkjet', 'Dot Matrix', 'Thermal'],
        'connectivity' => ['USB', 'LAN', 'Wi-Fi', 'Shared'],
    ];
    $optionStmt = $pdo->prepare('INSERT IGNORE INTO master_options (field_name, option_value) VALUES (?, ?)');
    foreach ($defaultOptions as $fieldName => $values) {
        foreach ($values as $value) {
            $optionStmt->execute([$fieldName, $value]);
        }
    }

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
    echo '<p>Database, users, inventory, assignment, request, and master configuration tables are ready.</p>';
    echo '<p>Admin login: <strong>admin@example.com</strong> / <strong>admin123</strong></p>';
    echo '<p><a href="index.html">Open website</a></p>';
} catch (Throwable $error) {
    http_response_code(500);
    echo '<h2>Setup failed</h2>';
    echo '<pre>' . htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre>';
}
