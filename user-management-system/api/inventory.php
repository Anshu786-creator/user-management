<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$user = require_user();
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? 'list';

function clean_value(array $input, string $key): string
{
    return trim((string)($input[$key] ?? ''));
}

function inventory_fields(): array
{
    return [
        'asset_type', 'asset_tag', 'brand', 'model', 'serial_number', 'location', 'department',
        'assigned_to', 'status', 'processor', 'ram', 'storage', 'operating_system',
        'ip_address', 'mac_address', 'printer_type', 'connectivity', 'toner_model', 'notes',
    ];
}

function inventory_data(array $input): array
{
    $data = [];
    foreach (inventory_fields() as $field) {
        $data[$field] = clean_value($input, $field);
    }
    $data['status'] = in_array($data['status'], ['active', 'repair', 'retired'], true) ? $data['status'] : 'active';
    return $data;
}

function request_fields(): array
{
    return [
        'asset_type', 'asset_tag', 'brand', 'model', 'serial_number', 'location', 'department',
        'assigned_to', 'asset_status', 'processor', 'ram', 'storage', 'operating_system',
        'ip_address', 'mac_address', 'printer_type', 'connectivity', 'toner_model', 'notes',
    ];
}

function request_data(array $data): array
{
    $request = $data;
    $request['asset_status'] = $data['status'];
    unset($request['status']);
    return $request;
}

function validate_inventory(array $data): void
{
    if (!in_array($data['asset_type'], ['computer', 'printer'], true) || $data['asset_tag'] === '') {
        json_response(['ok' => false, 'message' => 'Asset type and asset tag are required.'], 422);
    }
}

try {
    if ($action === 'list') {
        $type = $_GET['type'] ?? '';
        $search = trim((string)($_GET['search'] ?? ''));
        $params = [];
        $where = [];

        if (in_array($type, ['computer', 'printer'], true)) {
            $where[] = 'asset_type = ?';
            $params[] = $type;
        }

        if ($search !== '') {
            $where[] = '(asset_tag LIKE ? OR brand LIKE ? OR model LIKE ? OR serial_number LIKE ? OR location LIKE ? OR assigned_to LIKE ? OR department LIKE ?)';
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like, $like, $like, $like, $like);
        }

        $sql = 'SELECT * FROM inventory_items';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY updated_at DESC, id DESC';

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        json_response(['ok' => true, 'items' => $stmt->fetchAll()]);
    }

    if ($action === 'requests') {
        require_admin();
        $stmt = db()->query("
            SELECT r.*, u.name AS requested_by_name, reviewer.name AS reviewed_by_name
            FROM inventory_requests r
            LEFT JOIN users u ON u.id = r.requested_by
            LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
            ORDER BY FIELD(r.status, 'pending', 'approved', 'rejected'), r.created_at DESC
        ");
        json_response(['ok' => true, 'requests' => $stmt->fetchAll()]);
    }

    if ($action === 'assignment_history') {
        require_admin();
        $id = (int)($_GET['id'] ?? 0);
        $stmt = db()->prepare("
            SELECT a.*, admin.name AS assigned_by_name
            FROM inventory_assignments a
            LEFT JOIN users admin ON admin.id = a.assigned_by
            WHERE a.inventory_item_id = ?
            ORDER BY a.created_at DESC, a.id DESC
        ");
        $stmt->execute([$id]);
        json_response(['ok' => true, 'history' => $stmt->fetchAll()]);
    }

    if ($action === 'save') {
        $id = (int)($input['id'] ?? 0);
        $data = inventory_data($input);
        validate_inventory($data);
        $fields = inventory_fields();

        if ($user['role'] !== 'admin') {
            if ($id > 0) {
                json_response(['ok' => false, 'message' => 'Only admin can update approved inventory.'], 403);
            }
            $requestFields = request_fields();
            $requestData = request_data($data);
            $columns = implode(', ', [...$requestFields, 'requested_by']);
            $placeholders = rtrim(str_repeat('?, ', count($requestFields) + 1), ', ');
            $stmt = db()->prepare("INSERT INTO inventory_requests ($columns) VALUES ($placeholders)");
            $stmt->execute([...array_map(fn($field) => $requestData[$field], $requestFields), $user['id']]);
            json_response(['ok' => true, 'message' => 'Add request sent successfully. Admin approval is pending.', 'request_sent' => true]);
        }

        if ($id > 0) {
            $set = implode(', ', array_map(fn($field) => "$field = ?", $fields));
            $stmt = db()->prepare("UPDATE inventory_items SET $set WHERE id = ?");
            $stmt->execute([...array_values($data), $id]);
            json_response(['ok' => true, 'message' => 'Inventory item updated.']);
        }

        $columns = implode(', ', [...$fields, 'created_by']);
        $placeholders = rtrim(str_repeat('?, ', count($fields) + 1), ', ');
        $stmt = db()->prepare("INSERT INTO inventory_items ($columns) VALUES ($placeholders)");
        $stmt->execute([...array_values($data), $user['id']]);
        json_response(['ok' => true, 'message' => 'Inventory item added.']);
    }

    if ($action === 'approve') {
        $admin = require_admin();
        $id = (int)($input['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM inventory_requests WHERE id = ? AND status = ?');
        $stmt->execute([$id, 'pending']);
        $request = $stmt->fetch();

        if (!$request) {
            json_response(['ok' => false, 'message' => 'Pending request not found.'], 404);
        }

        $fields = inventory_fields();
        $data = [];
        foreach ($fields as $field) {
            $data[$field] = $field === 'status'
                ? (string)($request['asset_status'] ?? 'active')
                : (string)($request[$field] ?? '');
        }

        $columns = implode(', ', [...$fields, 'created_by']);
        $placeholders = rtrim(str_repeat('?, ', count($fields) + 1), ', ');
        $insert = db()->prepare("INSERT INTO inventory_items ($columns) VALUES ($placeholders)");
        $insert->execute([...array_values($data), $request['requested_by']]);

        $update = db()->prepare('UPDATE inventory_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?');
        $update->execute(['approved', $admin['id'], $id]);
        json_response(['ok' => true, 'message' => 'Request approved and added to inventory.']);
    }

    if ($action === 'assign') {
        $admin = require_admin();
        $id = (int)($input['id'] ?? 0);
        $targetType = (string)($input['target_type'] ?? 'existing');
        $toUserId = null;
        $toName = '';

        if ($targetType === 'existing') {
            $toUserId = (int)($input['to_user_id'] ?? 0);
            $userStmt = db()->prepare('SELECT id, name FROM users WHERE id = ?');
            $userStmt->execute([$toUserId]);
            $targetUser = $userStmt->fetch();
            if (!$targetUser) {
                json_response(['ok' => false, 'message' => 'Select an existing user for allotment.'], 422);
            }
            $toUserId = (int)$targetUser['id'];
            $toName = trim((string)$targetUser['name']);
        } else {
            $toName = clean_value($input, 'person_name');
        }

        if ($id <= 0 || $toName === '') {
            json_response(['ok' => false, 'message' => 'Select a system and the person receiving it.'], 422);
        }

        $itemStmt = db()->prepare('SELECT id, asset_tag, assigned_to, assigned_user_id FROM inventory_items WHERE id = ?');
        $itemStmt->execute([$id]);
        $item = $itemStmt->fetch();
        if (!$item) {
            json_response(['ok' => false, 'message' => 'Approved inventory item not found.'], 404);
        }

        $actionName = trim((string)$item['assigned_to']) === '' ? 'allot' : 'transfer';
        $note = clean_value($input, 'note');

        db()->beginTransaction();
        $update = db()->prepare('UPDATE inventory_items SET assigned_to = ?, assigned_user_id = ? WHERE id = ?');
        $update->execute([$toName, $toUserId, $id]);
        $history = db()->prepare("
            INSERT INTO inventory_assignments
                (inventory_item_id, assignment_action, from_assigned_to, to_assigned_to, from_user_id, to_user_id, note, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $history->execute([
            $id,
            $actionName,
            (string)$item['assigned_to'],
            $toName,
            $item['assigned_user_id'] ?: null,
            $toUserId,
            $note,
            $admin['id'],
        ]);
        db()->commit();

        json_response([
            'ok' => true,
            'message' => $actionName === 'allot'
                ? 'System allotted successfully.'
                : 'System transferred successfully.',
        ]);
    }

    if ($action === 'reject_request') {
        $admin = require_admin();
        $id = (int)($input['id'] ?? 0);
        $stmt = db()->prepare('UPDATE inventory_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND status = ?');
        $stmt->execute(['rejected', $admin['id'], $id, 'pending']);
        json_response(['ok' => true, 'message' => 'Request deleted/rejected.']);
    }

    if ($action === 'delete') {
        require_admin();
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            json_response(['ok' => false, 'message' => 'Invalid item.'], 422);
        }

        $stmt = db()->prepare('DELETE FROM inventory_items WHERE id = ?');
        $stmt->execute([$id]);
        json_response(['ok' => true, 'message' => 'Inventory item deleted.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown action.'], 404);
} catch (PDOException $error) {
    if (db()->inTransaction()) {
        db()->rollBack();
    }
    if ($error->getCode() === '23000') {
        json_response(['ok' => false, 'message' => 'Asset tag already exists in approved inventory.'], 409);
    }
    json_response(['ok' => false, 'message' => 'Server error: ' . $error->getMessage()], 500);
}
