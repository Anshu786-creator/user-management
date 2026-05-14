const emptyInventory = {
    id: '',
    asset_type: 'computer',
    asset_tag: '',
    brand: '',
    model: '',
    serial_number: '',
    location: '',
    department: '',
    assigned_to: '',
    status: 'active',
    processor: '',
    ram: '',
    storage: '',
    operating_system: '',
    ip_address: '',
    mac_address: '',
    printer_type: '',
    connectivity: '',
    toner_model: '',
    notes: '',
};

let state = {
    user: null,
    screen: 'login',
    activeView: 'inventory',
    inventoryType: '',
    search: '',
    profileForm: { name: '', phone: '', password: '' },
    inventoryForm: { ...emptyInventory },
    masterForm: { id: '', field_name: 'department', option_value: '', is_active: 1 },
    users: [],
    items: [],
    requests: [],
    masterOptions: {},
    message: '',
};

const root = document.getElementById('root');

async function api(url, body) {
    const options = body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {};
    const response = await fetch(url, options);
    return response.json();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[char]));
}

function html(strings, ...values) {
    return strings.reduce((output, string, index) => output + string + (values[index] ?? ''), '');
}

function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function activeOptions(field, fallback = []) {
    const rows = state.masterOptions[field] || [];
    const values = rows.filter((row) => String(row.is_active) === '1').map((row) => row.option_value);
    return values.length ? values : fallback;
}

function field(name, label, value, type = 'text', extra = '') {
    return html`<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

function selectField(name, label, value, options) {
    return html`
        <label>${label}
            <select name="${name}">
                ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
        </label>
    `;
}

async function init() {
    await loadMasterOptions();
    const data = await api('api/auth.php?action=me');
    if (data.user) {
        state.user = data.user;
        state.profileForm = { name: data.user.name, phone: data.user.phone || '', password: '' };
        await loadInventory();
        if (data.user.role === 'admin') {
            await loadUsers();
            await loadRequests();
        }
    }
    render();
}

async function loadInventory() {
    const query = new URLSearchParams({ type: state.inventoryType, search: state.search });
    const data = await api(`api/inventory.php?action=list&${query.toString()}`);
    if (data.ok) state.items = data.items;
}

async function loadRequests() {
    const data = await api('api/inventory.php?action=requests');
    if (data.ok) state.requests = data.requests;
}

async function loadUsers() {
    const data = await api('api/admin.php?action=list');
    if (data.ok) state.users = data.users;
}

async function loadMasterOptions() {
    const data = await api('api/master.php?action=list');
    if (data.ok) state.masterOptions = data.options;
}

function authPage() {
    return html`
        <main class="auth-page">
            <section class="auth-panel">
                <p class="eyebrow"></p>
                <h1>IT Inventory System</h1>
                
                <div class="tabs">
                    <button data-screen="login" class="${state.screen === 'login' ? 'active' : ''}">Login</button>
                    <button data-screen="register" class="${state.screen === 'register' ? 'active' : ''}">Register</button>
                </div>
                <form id="authForm" class="form">
                    ${state.screen === 'register' ? field('name', 'Name', '') + field('phone', 'Phone', '') : ''}
                    ${field('email', 'Email', '', 'email')}
                    ${field('password', 'Password', '', 'password')}
                    <button class="primary" type="submit">${state.screen === 'login' ? 'Login' : 'Create Account'}</button>
                </form>
                ${state.message ? `<p class="message">${escapeHtml(state.message)}</p>` : ''}
                <p class="hint">Admin: admin@example.com / admin123</p>
            </section>
        </main>
    `;
}

function dashboard() {
    return html`
        <main class="dashboard">
            <header class="topbar">
                <div>
                    <p class="eyebrow">${state.user.role === 'admin' ? 'Admin Dashboard' : 'User Dashboard'}</p>
                    <h1>Welcome, ${escapeHtml(state.user.name)}</h1>
                </div>
                <button class="ghost" id="logoutBtn">Logout</button>
            </header>
            <nav class="module-tabs">
                ${navButton('inventory', 'Inventory')}
                ${state.user.role === 'admin' ? navButton('requests', `Requests (${pendingCount()})`) : ''}
                ${state.user.role === 'admin' ? navButton('master', 'Master Configuration') : ''}
                ${navButton('profile', 'Profile')}
                ${state.user.role === 'admin' ? navButton('users', 'Users') : ''}
            </nav>
            ${state.message ? `<p class="message">${escapeHtml(state.message)}</p>` : ''}
            ${state.activeView === 'inventory' ? inventoryView() : ''}
            ${state.activeView === 'requests' && state.user.role === 'admin' ? requestsView() : ''}
            ${state.activeView === 'master' && state.user.role === 'admin' ? masterView() : ''}
            ${state.activeView === 'profile' ? profileView() : ''}
            ${state.activeView === 'users' && state.user.role === 'admin' ? usersView() : ''}
        </main>
    `;
}

function navButton(view, label) {
    return `<button data-view="${view}" class="${state.activeView === view ? 'active' : ''}">${label}</button>`;
}

function pendingCount() {
    return state.requests.filter((request) => request.status === 'pending').length;
}

function inventoryView() {
    const formTitle = state.user.role === 'admin'
        ? (state.inventoryForm.id ? 'Update Approved Product' : 'Add Product Directly')
        : 'Request New Product';
    return html`
        <section class="grid inventory-grid">
            <div class="panel">
                <h2>${formTitle}</h2>
                <form id="inventoryForm" class="form">
                    ${assetFields(state.inventoryForm)}
                    <div class="button-row">
                        <button class="primary" type="submit">${state.user.role === 'admin' ? 'Save Product' : 'Send Add Request'}</button>
                        <button class="ghost" type="button" id="clearInventory">Clear</button>
                    </div>
                </form>
            </div>
            <div class="panel wide">
                <div class="panel-head">
                    <h2>Approved Inventory</h2>
                    <div class="filters">
                        <select id="inventoryType">
                            <option value="" ${state.inventoryType === '' ? 'selected' : ''}>All</option>
                            <option value="computer" ${state.inventoryType === 'computer' ? 'selected' : ''}>Computer</option>
                            <option value="printer" ${state.inventoryType === 'printer' ? 'selected' : ''}>Printer</option>
                        </select>
                        <input id="searchBox" value="${escapeHtml(state.search)}" placeholder="Search asset, model, user">
                    </div>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Type</th><th>Asset</th><th>Model</th><th>Serial</th><th>Location</th><th>Assigned</th><th>Status</th>${state.user.role === 'admin' ? '<th>Action</th>' : ''}</tr>
                        </thead>
                        <tbody>
                            ${state.items.map((item) => inventoryRow(item)).join('') || `<tr><td colspan="${state.user.role === 'admin' ? '8' : '7'}">No approved inventory found.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
}

function assetFields(item) {
    return html`
        ${selectField('asset_type', 'Asset Type', item.asset_type, activeOptions('asset_type', ['computer', 'printer']))}
        ${field('asset_tag', 'Asset Tag', item.asset_tag)}
        ${field('brand', 'Brand', item.brand)}
        ${field('model', 'Model', item.model)}
        ${field('serial_number', 'Serial Number', item.serial_number)}
        ${selectField('location', 'Location', item.location, ['', ...activeOptions('location', ['IT Room'])])}
        ${selectField('department', 'Department', item.department, ['', ...activeOptions('department', ['IT'])])}
        ${field('assigned_to', 'Assigned To', item.assigned_to)}
        ${selectField('status', 'Status', item.status, activeOptions('status', ['active', 'repair', 'retired']))}
        <div class="computer-fields">
            ${field('processor', 'Processor', item.processor)}
            ${field('ram', 'RAM', item.ram)}
            ${field('storage', 'Storage', item.storage)}
            ${field('operating_system', 'Operating System', item.operating_system)}
            ${field('ip_address', 'IP Address', item.ip_address)}
            ${field('mac_address', 'MAC Address', item.mac_address)}
        </div>
        <div class="printer-fields">
            ${selectField('printer_type', 'Printer Type', item.printer_type, ['', ...activeOptions('printer_type', ['Laser', 'Inkjet'])])}
            ${selectField('connectivity', 'Connectivity', item.connectivity, ['', ...activeOptions('connectivity', ['USB', 'LAN', 'Wi-Fi'])])}
            ${field('toner_model', 'Toner Model', item.toner_model)}
        </div>
        <label>Notes<textarea name="notes">${escapeHtml(item.notes)}</textarea></label>
    `;
}

function inventoryRow(item) {
    return html`
        <tr>
            <td>${escapeHtml(item.asset_type)}</td>
            <td>${escapeHtml(item.asset_tag)}</td>
            <td>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</td>
            <td>${escapeHtml(item.serial_number)}</td>
            <td>${escapeHtml(item.location)}</td>
            <td>${escapeHtml(item.assigned_to)}</td>
            <td><span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
            ${state.user.role === 'admin' ? html`
                <td class="actions">
                    <button data-edit-item="${item.id}">Edit</button>
                    <button class="danger" data-delete-item="${item.id}">Delete</button>
                </td>
            ` : ''}
        </tr>
    `;
}

function requestsView() {
    return html`
        <section class="panel wide">
            <div class="panel-head">
                <h2>Pending Product Requests</h2>
                <button class="ghost" id="refreshRequests">Refresh</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Status</th><th>Requested By</th><th>Type</th><th>Asset</th><th>Details</th><th>Location</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        ${state.requests.map((request) => requestRow(request)).join('') || '<tr><td colspan="7">No requests found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function requestRow(request) {
    return html`
        <tr>
            <td><span class="status ${escapeHtml(request.status)}">${escapeHtml(request.status)}</span></td>
            <td>${escapeHtml(request.requested_by_name || 'User')}</td>
            <td>${escapeHtml(request.asset_type)}</td>
            <td>${escapeHtml(request.asset_tag)}</td>
            <td>${escapeHtml(request.brand)} ${escapeHtml(request.model)}<br><small>${escapeHtml(request.serial_number)} ${escapeHtml(request.processor || request.printer_type)}</small></td>
            <td>${escapeHtml(request.location)}<br><small>${escapeHtml(request.department)}</small></td>
            <td class="actions">
                ${request.status === 'pending' ? html`
                    <button data-approve-request="${request.id}">Approve</button>
                    <button class="danger" data-reject-request="${request.id}">Delete</button>
                ` : `<small>Reviewed by ${escapeHtml(request.reviewed_by_name || 'admin')}</small>`}
            </td>
        </tr>
    `;
}

function masterView() {
    const rows = Object.values(state.masterOptions).flat();
    return html`
        <section class="grid master-grid">
            <div class="panel">
                <h2>${state.masterForm.id ? 'Edit Master Field' : 'Add Master Field'}</h2>
                <form id="masterForm" class="form">
                    ${selectField('field_name', 'Product Field', state.masterForm.field_name, ['asset_type', 'status', 'department', 'location', 'printer_type', 'connectivity'])}
                    ${field('option_value', 'Field Value', state.masterForm.option_value)}
                    <label class="inline-check"><input type="checkbox" name="is_active" value="1" ${Number(state.masterForm.is_active) ? 'checked' : ''}> Active</label>
                    <div class="button-row">
                        <button class="primary" type="submit">Save Field</button>
                        <button class="ghost" type="button" id="clearMaster">Clear</button>
                    </div>
                </form>
            </div>
            <div class="panel wide">
                <h2>Master Configuration</h2>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Field</th><th>Value</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                            ${rows.map((row) => html`
                                <tr>
                                    <td>${escapeHtml(row.field_name)}</td>
                                    <td>${escapeHtml(row.option_value)}</td>
                                    <td>${Number(row.is_active) ? 'Active' : 'Inactive'}</td>
                                    <td class="actions">
                                        <button data-edit-master="${row.id}">Edit</button>
                                        <button class="danger" data-delete-master="${row.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="4">No master fields found.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
}

function profileView() {
    return html`
        <section class="panel profile-panel">
            <h2>Profile Update</h2>
            <form id="profileForm" class="form">
                ${field('name', 'Name', state.profileForm.name)}
                ${field('email', 'Email', state.user.email, 'email', 'disabled')}
                ${field('phone', 'Phone', state.profileForm.phone)}
                ${field('password', 'New Password', state.profileForm.password, 'password', 'placeholder="Leave blank to keep current password"')}
                <button class="primary" type="submit">Save Profile</button>
            </form>
        </section>
    `;
}

function usersView() {
    return html`
        <section class="panel wide">
            <div class="panel-head">
                <h2>Registered Users</h2>
                <button class="ghost" id="refreshUsers">Refresh</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Action</th></tr></thead>
                    <tbody>
                        ${state.users.map((user) => html`
                            <tr>
                                <td><input data-user-field="name" data-user-id="${user.id}" value="${escapeHtml(user.name)}"></td>
                                <td>${escapeHtml(user.email)}</td>
                                <td><input data-user-field="phone" data-user-id="${user.id}" value="${escapeHtml(user.phone || '')}"></td>
                                <td>
                                    <select data-user-field="role" data-user-id="${user.id}">
                                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                                    </select>
                                </td>
                                <td class="actions">
                                    <button data-save-user="${user.id}">Save</button>
                                    <button class="danger" data-delete-user="${user.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function render() {
    root.innerHTML = state.user ? dashboard() : authPage();
    bindEvents();
    toggleAssetFields();
}

function bindEvents() {
    document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => {
        state.screen = button.dataset.screen;
        state.message = '';
        render();
    }));

    document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', async () => {
        state.activeView = button.dataset.view;
        state.message = '';
        if (state.activeView === 'requests') await loadRequests();
        if (state.activeView === 'master') await loadMasterOptions();
        render();
    }));

    document.getElementById('authForm')?.addEventListener('submit', submitAuth);
    document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
    document.getElementById('inventoryForm')?.addEventListener('submit', saveInventory);
    document.getElementById('masterForm')?.addEventListener('submit', saveMaster);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('clearInventory')?.addEventListener('click', () => {
        state.inventoryForm = { ...emptyInventory };
        render();
    });
    document.getElementById('clearMaster')?.addEventListener('click', () => {
        state.masterForm = { id: '', field_name: 'department', option_value: '', is_active: 1 };
        render();
    });
    document.getElementById('refreshRequests')?.addEventListener('click', async () => {
        await loadRequests();
        render();
    });
    document.getElementById('refreshUsers')?.addEventListener('click', async () => {
        await loadUsers();
        render();
    });

    document.querySelector('[name="asset_type"]')?.addEventListener('change', (event) => {
        state.inventoryForm.asset_type = event.target.value;
        toggleAssetFields();
    });

    document.getElementById('inventoryType')?.addEventListener('change', async (event) => {
        state.inventoryType = event.target.value;
        await loadInventory();
        render();
    });

    document.getElementById('searchBox')?.addEventListener('change', async (event) => {
        state.search = event.target.value;
        await loadInventory();
        render();
    });

    document.querySelectorAll('[data-edit-item]').forEach((button) => button.addEventListener('click', () => {
        const item = state.items.find((row) => String(row.id) === button.dataset.editItem);
        state.inventoryForm = { ...emptyInventory, ...item };
        render();
    }));

    document.querySelectorAll('[data-delete-item]').forEach((button) => button.addEventListener('click', () => deleteInventory(button.dataset.deleteItem)));
    document.querySelectorAll('[data-approve-request]').forEach((button) => button.addEventListener('click', () => approveRequest(button.dataset.approveRequest)));
    document.querySelectorAll('[data-reject-request]').forEach((button) => button.addEventListener('click', () => rejectRequest(button.dataset.rejectRequest)));

    document.querySelectorAll('[data-edit-master]').forEach((button) => button.addEventListener('click', () => {
        const row = Object.values(state.masterOptions).flat().find((option) => String(option.id) === button.dataset.editMaster);
        state.masterForm = { ...row };
        render();
    }));
    document.querySelectorAll('[data-delete-master]').forEach((button) => button.addEventListener('click', () => deleteMaster(button.dataset.deleteMaster)));

    document.querySelectorAll('[data-user-field]').forEach((input) => input.addEventListener('change', () => {
        state.users = state.users.map((user) => String(user.id) === input.dataset.userId ? { ...user, [input.dataset.userField]: input.value } : user);
    }));
    document.querySelectorAll('[data-save-user]').forEach((button) => button.addEventListener('click', () => saveManagedUser(button.dataset.saveUser)));
    document.querySelectorAll('[data-delete-user]').forEach((button) => button.addEventListener('click', () => deleteManagedUser(button.dataset.deleteUser)));
}

function toggleAssetFields() {
    const type = document.querySelector('[name="asset_type"]')?.value || state.inventoryForm.asset_type;
    document.querySelectorAll('.computer-fields').forEach((block) => block.style.display = type === 'computer' ? 'grid' : 'none');
    document.querySelectorAll('.printer-fields').forEach((block) => block.style.display = type === 'printer' ? 'grid' : 'none');
}

async function submitAuth(event) {
    event.preventDefault();
    const data = await api(`api/auth.php?action=${state.screen}`, formData(event.target));
    state.message = data.message || '';

    if (data.ok && state.screen === 'login') {
        state.user = data.user;
        state.profileForm = { name: data.user.name, phone: data.user.phone || '', password: '' };
        await loadMasterOptions();
        await loadInventory();
        if (data.user.role === 'admin') {
            await loadUsers();
            await loadRequests();
        }
    }

    if (data.ok && state.screen === 'register') state.screen = 'login';
    render();
}

async function saveProfile(event) {
    event.preventDefault();
    const data = await api('api/profile.php', formData(event.target));
    state.message = data.message || '';
    if (data.ok) {
        state.user = data.user;
        state.profileForm = { name: data.user.name, phone: data.user.phone || '', password: '' };
    }
    render();
}

async function saveInventory(event) {
    event.preventDefault();
    const payload = { ...state.inventoryForm, ...formData(event.target) };
    const data = await api('api/inventory.php?action=save', payload);
    state.message = data.message || '';
    if (data.ok) {
        if (data.request_sent) alert('Add request sent successful');
        state.inventoryForm = { ...emptyInventory, asset_type: payload.asset_type };
        await loadInventory();
        if (state.user.role === 'admin') await loadRequests();
    }
    render();
}

async function deleteInventory(id) {
    if (!confirm('Delete this approved inventory item?')) return;
    const data = await api('api/inventory.php?action=delete', { id });
    state.message = data.message || '';
    await loadInventory();
    render();
}

async function approveRequest(id) {
    const data = await api('api/inventory.php?action=approve', { id });
    state.message = data.message || '';
    await loadRequests();
    await loadInventory();
    render();
}

async function rejectRequest(id) {
    if (!confirm('Delete/reject this request?')) return;
    const data = await api('api/inventory.php?action=reject_request', { id });
    state.message = data.message || '';
    await loadRequests();
    render();
}

async function saveMaster(event) {
    event.preventDefault();
    const payload = { ...state.masterForm, ...formData(event.target) };
    payload.is_active = payload.is_active ? 1 : 0;
    const data = await api('api/master.php?action=save', payload);
    state.message = data.message || '';
    if (data.ok) {
        state.masterForm = { id: '', field_name: payload.field_name, option_value: '', is_active: 1 };
        await loadMasterOptions();
    }
    render();
}

async function deleteMaster(id) {
    if (!confirm('Delete this master field value?')) return;
    const data = await api('api/master.php?action=delete', { id });
    state.message = data.message || '';
    await loadMasterOptions();
    render();
}

async function saveManagedUser(id) {
    const user = state.users.find((row) => String(row.id) === String(id));
    const data = await api('api/admin.php?action=update', user);
    state.message = data.message || '';
    await loadUsers();
    render();
}

async function deleteManagedUser(id) {
    if (!confirm('Delete this user?')) return;
    const data = await api('api/admin.php?action=delete', { id });
    state.message = data.message || '';
    await loadUsers();
    render();
}

async function logout() {
    await api('api/auth.php?action=logout');
    state.user = null;
    state.users = [];
    state.items = [];
    state.requests = [];
    state.screen = 'login';
    state.activeView = 'inventory';
    state.message = 'Logged out.';
    render();
}

init();
