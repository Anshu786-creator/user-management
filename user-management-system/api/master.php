<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$user = require_user();
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? 'list';

try {
    if ($action === 'list') {
        $stmt = db()->query('SELECT id, field_name, option_value, is_active FROM master_options ORDER BY field_name, option_value');
        $options = [];
        foreach ($stmt->fetchAll() as $row) {
            $options[$row['field_name']][] = $row;
        }
        json_response(['ok' => true, 'options' => $options]);
    }

    require_admin();

    if ($action === 'save') {
        $id = (int)($input['id'] ?? 0);
        $fieldName = trim((string)($input['field_name'] ?? ''));
        $optionValue = trim((string)($input['option_value'] ?? ''));
        $isActive = !empty($input['is_active']) ? 1 : 0;

        if ($fieldName === '' || $optionValue === '') {
            json_response(['ok' => false, 'message' => 'Field name and value are required.'], 422);
        }

        if ($id > 0) {
            $stmt = db()->prepare('UPDATE master_options SET field_name = ?, option_value = ?, is_active = ? WHERE id = ?');
            $stmt->execute([$fieldName, $optionValue, $isActive, $id]);
            json_response(['ok' => true, 'message' => 'Master option updated.']);
        }

        $stmt = db()->prepare('INSERT INTO master_options (field_name, option_value, is_active) VALUES (?, ?, ?)');
        $stmt->execute([$fieldName, $optionValue, $isActive]);
        json_response(['ok' => true, 'message' => 'Master option added.']);
    }

    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        $stmt = db()->prepare('DELETE FROM master_options WHERE id = ?');
        $stmt->execute([$id]);
        json_response(['ok' => true, 'message' => 'Master option deleted.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown action.'], 404);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        json_response(['ok' => false, 'message' => 'This master option already exists.'], 409);
    }
    json_response(['ok' => false, 'message' => 'Server error: ' . $error->getMessage()], 500);
}
