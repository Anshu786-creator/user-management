import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const blankInventory = {
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
const blankMaster = { id: '', field_name: 'department', option_value: '', is_active: 1 };
const blankAssignment = { id: '', target_type: 'existing', to_user_id: '', person_name: '', note: '' };
const masterFields = ['asset_type', 'status', 'department', 'location', 'printer_type', 'connectivity'];

async function api(url, body) {
    const options = body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {};
    const response = await fetch(url, options);
    return response.json();
}

function optionsFor(options, field, fallback) {
    const values = (options[field] || [])
        .filter((option) => Number(option.is_active))
        .map((option) => option.option_value);
    return values.length ? values : fallback;
}

function TextField({ label, name, value, onChange, type = 'text', disabled = false, placeholder = '' }) {
    return (
        <label>
            {label}
            <input name={name} type={type} value={value ?? ''} onChange={onChange} disabled={disabled} placeholder={placeholder} />
        </label>
    );
}

function SelectField({ label, name, value, options, onChange }) {
    return (
        <label>
            {label}
            <select name={name} value={value ?? ''} onChange={onChange}>
                {options.map((option) => <option key={`${name}-${option}`} value={option}>{option}</option>)}
            </select>
        </label>
    );
}

function Message({ children }) {
    return children ? <p className="message">{children}</p> : null;
}

function Status({ value }) {
    return <span className={`status ${value}`}>{value}</span>;
}

function App() {
    const [user, setUser] = useState(null);
    const [screen, setScreen] = useState('login');
    const [activeView, setActiveView] = useState('inventory');
    const [message, setMessage] = useState('');
    const [inventoryType, setInventoryType] = useState('');
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState([]);
    const [masterOptions, setMasterOptions] = useState({});
    const [authForm, setAuthForm] = useState({ name: '', phone: '', email: '', password: '' });
    const [inventoryForm, setInventoryForm] = useState(blankInventory);
    const [masterForm, setMasterForm] = useState(blankMaster);
    const [assignmentForm, setAssignmentForm] = useState(blankAssignment);
    const [assignmentItem, setAssignmentItem] = useState(null);
    const [assignmentHistory, setAssignmentHistory] = useState([]);
    const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '' });

    useEffect(() => {
        initialize();
    }, []);

    async function initialize() {
        await loadMasterOptions();
        const auth = await api('api/auth.php?action=me');
        if (auth.user) await enterSession(auth.user);
    }

    async function enterSession(nextUser) {
        setUser(nextUser);
        setProfileForm({ name: nextUser.name, phone: nextUser.phone || '', password: '' });
        await loadInventory();
        if (nextUser.role === 'admin') {
            await Promise.all([loadUsers(), loadRequests()]);
        }
    }

    async function loadInventory(type = inventoryType, term = search) {
        const query = new URLSearchParams({ type, search: term });
        const data = await api(`api/inventory.php?action=list&${query.toString()}`);
        if (data.ok) setItems(data.items);
    }

    async function loadRequests() {
        const data = await api('api/inventory.php?action=requests');
        if (data.ok) setRequests(data.requests);
    }

    async function loadUsers() {
        const data = await api('api/admin.php?action=list');
        if (data.ok) setUsers(data.users);
    }

    async function loadMasterOptions() {
        const data = await api('api/master.php?action=list');
        if (data.ok) setMasterOptions(data.options);
    }

    async function loadAssignmentHistory(id) {
        const data = await api(`api/inventory.php?action=assignment_history&id=${id}`);
        if (data.ok) setAssignmentHistory(data.history);
    }

    const activeOptions = (field, fallback) => optionsFor(masterOptions, field, fallback);
    const pendingRequests = requests.filter((request) => request.status === 'pending').length;
    const masterRows = useMemo(() => Object.values(masterOptions).flat(), [masterOptions]);

    async function submitAuth(event) {
        event.preventDefault();
        const data = await api(`api/auth.php?action=${screen}`, authForm);
        setMessage(data.message || '');
        if (data.ok && screen === 'login') await enterSession(data.user);
        if (data.ok && screen === 'register') {
            setScreen('login');
            setAuthForm({ name: '', phone: '', email: '', password: '' });
        }
    }

    async function saveInventory(event) {
        event.preventDefault();
        const data = await api('api/inventory.php?action=save', inventoryForm);
        setMessage(data.message || '');
        if (!data.ok) return;
        if (data.request_sent) window.alert('Add request sent successful');
        setInventoryForm({ ...blankInventory, asset_type: inventoryForm.asset_type });
        await loadInventory();
        if (user.role === 'admin') await loadRequests();
    }

    async function saveProfile(event) {
        event.preventDefault();
        const data = await api('api/profile.php', profileForm);
        setMessage(data.message || '');
        if (data.ok) {
            setUser(data.user);
            setProfileForm({ name: data.user.name, phone: data.user.phone || '', password: '' });
        }
    }

    async function saveMaster(event) {
        event.preventDefault();
        const data = await api('api/master.php?action=save', masterForm);
        setMessage(data.message || '');
        if (data.ok) {
            setMasterForm({ ...blankMaster, field_name: masterForm.field_name });
            await loadMasterOptions();
        }
    }

    async function openAssignment(item) {
        setAssignmentItem(item);
        setAssignmentForm({
            ...blankAssignment,
            id: item.id,
            to_user_id: users.find((row) => row.id !== user.id)?.id || users[0]?.id || '',
        });
        await loadAssignmentHistory(item.id);
    }

    async function saveAssignment(event) {
        event.preventDefault();
        const data = await api('api/inventory.php?action=assign', assignmentForm);
        setMessage(data.message || '');
        if (!data.ok) return;
        await loadInventory();
        await loadAssignmentHistory(assignmentForm.id);
        setAssignmentItem((item) => item ? { ...item, assigned_to: assignmentForm.target_type === 'existing'
            ? users.find((row) => String(row.id) === String(assignmentForm.to_user_id))?.name || item.assigned_to
            : assignmentForm.person_name } : item);
        setAssignmentForm((form) => ({ ...blankAssignment, id: form.id, to_user_id: form.to_user_id }));
    }

    async function deleteInventory(id) {
        if (!window.confirm('Delete this approved inventory item?')) return;
        const data = await api('api/inventory.php?action=delete', { id });
        setMessage(data.message || '');
        await loadInventory();
    }

    async function approveRequest(id) {
        const data = await api('api/inventory.php?action=approve', { id });
        setMessage(data.message || '');
        await Promise.all([loadRequests(), loadInventory()]);
    }

    async function rejectRequest(id) {
        if (!window.confirm('Delete/reject this request?')) return;
        const data = await api('api/inventory.php?action=reject_request', { id });
        setMessage(data.message || '');
        await loadRequests();
    }

    async function deleteMaster(id) {
        if (!window.confirm('Delete this master field value?')) return;
        const data = await api('api/master.php?action=delete', { id });
        setMessage(data.message || '');
        await loadMasterOptions();
    }

    async function saveManagedUser(nextUser) {
        const data = await api('api/admin.php?action=update', nextUser);
        setMessage(data.message || '');
        await loadUsers();
    }

    async function deleteManagedUser(id) {
        if (!window.confirm('Delete this user?')) return;
        const data = await api('api/admin.php?action=delete', { id });
        setMessage(data.message || '');
        await loadUsers();
    }

    async function logout() {
        await api('api/auth.php?action=logout');
        setUser(null);
        setUsers([]);
        setRequests([]);
        setItems([]);
        setAssignmentItem(null);
        setAssignmentHistory([]);
        setActiveView('inventory');
        setScreen('login');
        setMessage('Logged out.');
    }

    const updateInventory = (event) => setInventoryForm((form) => ({
        ...form,
        [event.target.name]: event.target.value,
    }));
    const updateAuth = (event) => setAuthForm((form) => ({
        ...form,
        [event.target.name]: event.target.value,
    }));
    const updateProfile = (event) => setProfileForm((form) => ({
        ...form,
        [event.target.name]: event.target.value,
    }));
    const updateMaster = (event) => setMasterForm((form) => ({
        ...form,
        [event.target.name]: event.target.type === 'checkbox' ? (event.target.checked ? 1 : 0) : event.target.value,
    }));
    const updateAssignment = (event) => setAssignmentForm((form) => ({
        ...form,
        [event.target.name]: event.target.value,
    }));

    if (!user) {
        return (
            <main className="auth-page">
                <section className="auth-panel">
                    <p className="eyebrow">Local Network Inventory</p>
                    <h1>IT Inventory System</h1>
                    <p className="subtitle">Users send new product requests. Admin approves before items enter inventory.</p>
                    <div className="tabs">
                        <button className={screen === 'login' ? 'active' : ''} onClick={() => setScreen('login')}>Login</button>
                        <button className={screen === 'register' ? 'active' : ''} onClick={() => setScreen('register')}>Register</button>
                    </div>
                    <form className="form" onSubmit={submitAuth}>
                        {screen === 'register' && <TextField label="Name" name="name" value={authForm.name} onChange={updateAuth} />}
                        {screen === 'register' && <TextField label="Phone" name="phone" value={authForm.phone} onChange={updateAuth} />}
                        <TextField label="Email" name="email" type="email" value={authForm.email} onChange={updateAuth} />
                        <TextField label="Password" name="password" type="password" value={authForm.password} onChange={updateAuth} />
                        <button className="primary" type="submit">{screen === 'login' ? 'Login' : 'Create Account'}</button>
                    </form>
                    <Message>{message}</Message>
                    <p className="hint">Admin: admin@example.com / admin123</p>
                </section>
            </main>
        );
    }

    return (
        <main className="dashboard">
            <header className="topbar">
                <div>
                    <p className="eyebrow">{user.role === 'admin' ? 'Admin Dashboard' : 'User Dashboard'}</p>
                    <h1>Welcome, {user.name}</h1>
                </div>
                <button className="ghost" onClick={logout}>Logout</button>
            </header>
            <nav className="module-tabs">
                <NavButton view="inventory" activeView={activeView} onClick={setActiveView}>Inventory</NavButton>
                {user.role === 'admin' && <NavButton view="requests" activeView={activeView} onClick={async () => { await loadRequests(); setActiveView('requests'); }}>Requests ({pendingRequests})</NavButton>}
                {user.role === 'admin' && <NavButton view="master" activeView={activeView} onClick={async () => { await loadMasterOptions(); setActiveView('master'); }}>Master Configuration</NavButton>}
                <NavButton view="profile" activeView={activeView} onClick={setActiveView}>Profile</NavButton>
                {user.role === 'admin' && <NavButton view="users" activeView={activeView} onClick={setActiveView}>Users</NavButton>}
            </nav>
            <Message>{message}</Message>
            {activeView === 'inventory' && (
                <InventoryView
                    user={user}
                    form={inventoryForm}
                    items={items}
                    inventoryType={inventoryType}
                    search={search}
                    activeOptions={activeOptions}
                    onChange={updateInventory}
                    onClear={() => setInventoryForm(blankInventory)}
                    onEdit={(item) => setInventoryForm({ ...blankInventory, ...item })}
                    onDelete={deleteInventory}
                    onAssign={openAssignment}
                    onSave={saveInventory}
                    users={users}
                    assignmentItem={assignmentItem}
                    assignmentForm={assignmentForm}
                    assignmentHistory={assignmentHistory}
                    onAssignmentChange={updateAssignment}
                    onAssignmentSave={saveAssignment}
                    onAssignmentClose={() => { setAssignmentItem(null); setAssignmentHistory([]); }}
                    onSearch={async (value) => { setSearch(value); await loadInventory(inventoryType, value); }}
                    onType={async (value) => { setInventoryType(value); await loadInventory(value, search); }}
                />
            )}
            {activeView === 'requests' && user.role === 'admin' && <RequestsView requests={requests} onApprove={approveRequest} onReject={rejectRequest} onRefresh={loadRequests} />}
            {activeView === 'master' && user.role === 'admin' && (
                <MasterView
                    form={masterForm}
                    rows={masterRows}
                    onChange={updateMaster}
                    onSave={saveMaster}
                    onClear={() => setMasterForm(blankMaster)}
                    onEdit={(row) => setMasterForm(row)}
                    onDelete={deleteMaster}
                />
            )}
            {activeView === 'profile' && <ProfileView form={profileForm} user={user} onChange={updateProfile} onSave={saveProfile} />}
            {activeView === 'users' && user.role === 'admin' && <UsersView users={users} setUsers={setUsers} onSave={saveManagedUser} onDelete={deleteManagedUser} onRefresh={loadUsers} />}
        </main>
    );
}

function NavButton({ view, activeView, onClick, children }) {
    return <button className={activeView === view ? 'active' : ''} onClick={() => onClick(view)}>{children}</button>;
}

function AssetFields({ form, activeOptions, onChange }) {
    const printer = form.asset_type === 'printer';
    return (
        <>
            <SelectField label="Asset Type" name="asset_type" value={form.asset_type} options={activeOptions('asset_type', ['computer', 'printer'])} onChange={onChange} />
            <TextField label="Asset Tag" name="asset_tag" value={form.asset_tag} onChange={onChange} />
            <TextField label="Brand" name="brand" value={form.brand} onChange={onChange} />
            <TextField label="Model" name="model" value={form.model} onChange={onChange} />
            <TextField label="Serial Number" name="serial_number" value={form.serial_number} onChange={onChange} />
            <SelectField label="Location" name="location" value={form.location} options={['', ...activeOptions('location', ['IT Room'])]} onChange={onChange} />
            <SelectField label="Department" name="department" value={form.department} options={['', ...activeOptions('department', ['IT'])]} onChange={onChange} />
            <TextField label="Assigned To" name="assigned_to" value={form.assigned_to} onChange={onChange} />
            <SelectField label="Status" name="status" value={form.status} options={activeOptions('status', ['active', 'repair', 'retired'])} onChange={onChange} />
            {!printer && <div className="computer-fields">
                <TextField label="Processor" name="processor" value={form.processor} onChange={onChange} />
                <TextField label="RAM" name="ram" value={form.ram} onChange={onChange} />
                <TextField label="Storage" name="storage" value={form.storage} onChange={onChange} />
                <TextField label="Operating System" name="operating_system" value={form.operating_system} onChange={onChange} />
                <TextField label="IP Address" name="ip_address" value={form.ip_address} onChange={onChange} />
                <TextField label="MAC Address" name="mac_address" value={form.mac_address} onChange={onChange} />
            </div>}
            {printer && <div className="printer-fields">
                <SelectField label="Printer Type" name="printer_type" value={form.printer_type} options={['', ...activeOptions('printer_type', ['Laser', 'Inkjet'])]} onChange={onChange} />
                <SelectField label="Connectivity" name="connectivity" value={form.connectivity} options={['', ...activeOptions('connectivity', ['USB', 'LAN', 'Wi-Fi'])]} onChange={onChange} />
                <TextField label="Toner Model" name="toner_model" value={form.toner_model} onChange={onChange} />
            </div>}
            <label>Notes<textarea name="notes" value={form.notes} onChange={onChange} /></label>
        </>
    );
}

function InventoryView(props) {
    const {
        user, form, items, inventoryType, search, activeOptions, onChange, onClear, onEdit,
        onDelete, onAssign, onSave, onSearch, onType, users, assignmentItem, assignmentForm,
        assignmentHistory, onAssignmentChange, onAssignmentSave, onAssignmentClose,
    } = props;
    return (
        <>
            <section className="grid inventory-grid">
                <div className="panel">
                    <h2>{user.role === 'admin' ? (form.id ? 'Update Approved Product' : 'Add Product Directly') : 'Request New Product'}</h2>
                    <form className="form" onSubmit={onSave}>
                        <AssetFields form={form} activeOptions={activeOptions} onChange={onChange} />
                        <div className="button-row">
                            <button className="primary" type="submit">{user.role === 'admin' ? 'Save Product' : 'Send Add Request'}</button>
                            <button className="ghost" type="button" onClick={onClear}>Clear</button>
                        </div>
                    </form>
                </div>
                <div className="panel wide">
                    <div className="panel-head">
                        <h2>Approved Inventory</h2>
                        <div className="filters">
                            <select value={inventoryType} onChange={(event) => onType(event.target.value)}>
                                <option value="">All</option>
                                <option value="computer">Computer</option>
                                <option value="printer">Printer</option>
                            </select>
                            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search asset, model, user" />
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Type</th><th>Asset</th><th>Model</th><th>Serial</th><th>Location</th><th>Assigned</th><th>Status</th>{user.role === 'admin' && <th>Action</th>}</tr></thead>
                            <tbody>
                                {items.length === 0 && <tr><td colSpan={user.role === 'admin' ? 8 : 7}>No approved inventory found.</td></tr>}
                                {items.map((item) => <tr key={item.id}>
                                    <td>{item.asset_type}</td><td>{item.asset_tag}</td><td>{item.brand} {item.model}</td><td>{item.serial_number}</td><td>{item.location}</td><td>{item.assigned_to || 'Unassigned'}</td><td><Status value={item.status} /></td>
                                    {user.role === 'admin' && <td className="actions"><button type="button" onClick={() => onAssign(item)}>{item.assigned_to ? 'Transfer' : 'Allot'}</button><button type="button" onClick={() => onEdit(item)}>Edit</button><button type="button" className="danger" onClick={() => onDelete(item.id)}>Delete</button></td>}
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            {user.role === 'admin' && assignmentItem && <AssignmentPanel
                item={assignmentItem}
                form={assignmentForm}
                users={users}
                history={assignmentHistory}
                onChange={onAssignmentChange}
                onSave={onAssignmentSave}
                onClose={onAssignmentClose}
            />}
        </>
    );
}

function AssignmentPanel({ item, form, users, history, onChange, onSave, onClose }) {
    const transfer = Boolean(item.assigned_to);
    return (
        <section className="panel wide assignment-panel">
            <div className="panel-head">
                <div>
                    <p className="eyebrow">{transfer ? 'Transfer System' : 'Allot System'}</p>
                    <h2>{item.asset_tag} {item.brand} {item.model}</h2>
                    <p className="hint">Current assignment: {item.assigned_to || 'Unassigned'}</p>
                </div>
                <button className="ghost" type="button" onClick={onClose}>Close</button>
            </div>
            <div className="assignment-grid">
                <form className="form" onSubmit={onSave}>
                    <SelectField label="Allot To" name="target_type" value={form.target_type} options={['existing', 'new person']} onChange={onChange} />
                    {form.target_type === 'existing'
                        ? <label>Existing User<select name="to_user_id" value={form.to_user_id} onChange={onChange}>
                            <option value="">Choose user</option>
                            {users.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}
                        </select></label>
                        : <TextField label="New Person Name" name="person_name" value={form.person_name} onChange={onChange} />}
                    {form.target_type === 'existing' && <p className="hint selected-user">Selected: {users.find((row) => String(row.id) === String(form.to_user_id))?.name || 'Choose a user'}</p>}
                    <TextField label="Transfer Note" name="note" value={form.note} onChange={onChange} placeholder="Optional reason or handover note" />
                    <button className="primary" type="submit">{transfer ? 'Transfer System' : 'Allot System'}</button>
                </form>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Action</th><th>From</th><th>To</th><th>Admin</th><th>Note</th></tr></thead>
                        <tbody>
                            {history.length === 0 && <tr><td colSpan="6">No allotment history yet.</td></tr>}
                            {history.map((entry) => <tr key={entry.id}>
                                <td>{entry.created_at}</td><td>{entry.assignment_action}</td><td>{entry.from_assigned_to || 'Unassigned'}</td><td>{entry.to_assigned_to}</td><td>{entry.assigned_by_name || 'Admin'}</td><td>{entry.note}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function RequestsView({ requests, onApprove, onReject, onRefresh }) {
    return (
        <section className="panel wide">
            <div className="panel-head"><h2>Pending Product Requests</h2><button className="ghost" onClick={onRefresh}>Refresh</button></div>
            <div className="table-wrap"><table>
                <thead><tr><th>Status</th><th>Requested By</th><th>Type</th><th>Asset</th><th>Details</th><th>Location</th><th>Action</th></tr></thead>
                <tbody>
                    {requests.length === 0 && <tr><td colSpan="7">No requests found.</td></tr>}
                    {requests.map((request) => <tr key={request.id}>
                        <td><Status value={request.status} /></td><td>{request.requested_by_name || 'User'}</td><td>{request.asset_type}</td><td>{request.asset_tag}</td>
                        <td>{request.brand} {request.model}<br /><small>{request.serial_number} {request.processor || request.printer_type}</small></td>
                        <td>{request.location}<br /><small>{request.department}</small></td>
                        <td className="actions">{request.status === 'pending' ? <><button onClick={() => onApprove(request.id)}>Approve</button><button className="danger" onClick={() => onReject(request.id)}>Delete</button></> : <small>Reviewed by {request.reviewed_by_name || 'admin'}</small>}</td>
                    </tr>)}
                </tbody>
            </table></div>
        </section>
    );
}

function MasterView({ form, rows, onChange, onSave, onClear, onEdit, onDelete }) {
    return (
        <section className="grid master-grid">
            <div className="panel">
                <h2>{form.id ? 'Edit Master Field' : 'Add Master Field'}</h2>
                <form className="form" onSubmit={onSave}>
                    <SelectField label="Product Field" name="field_name" value={form.field_name} options={masterFields} onChange={onChange} />
                    <TextField label="Field Value" name="option_value" value={form.option_value} onChange={onChange} />
                    <label className="inline-check"><input type="checkbox" name="is_active" checked={Number(form.is_active) === 1} onChange={onChange} /> Active</label>
                    <div className="button-row"><button className="primary" type="submit">Save Field</button><button className="ghost" type="button" onClick={onClear}>Clear</button></div>
                </form>
            </div>
            <div className="panel wide"><h2>Master Configuration</h2><div className="table-wrap"><table>
                <thead><tr><th>Field</th><th>Value</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.id}><td>{row.field_name}</td><td>{row.option_value}</td><td>{Number(row.is_active) ? 'Active' : 'Inactive'}</td><td className="actions"><button onClick={() => onEdit(row)}>Edit</button><button className="danger" onClick={() => onDelete(row.id)}>Delete</button></td></tr>)}</tbody>
            </table></div></div>
        </section>
    );
}

function ProfileView({ form, user, onChange, onSave }) {
    return <section className="panel profile-panel"><h2>Profile Update</h2><form className="form" onSubmit={onSave}>
        <TextField label="Name" name="name" value={form.name} onChange={onChange} />
        <TextField label="Email" name="email" type="email" value={user.email} disabled />
        <TextField label="Phone" name="phone" value={form.phone} onChange={onChange} />
        <TextField label="New Password" name="password" type="password" value={form.password} onChange={onChange} placeholder="Leave blank to keep current password" />
        <button className="primary" type="submit">Save Profile</button>
    </form></section>;
}

function UsersView({ users, setUsers, onSave, onDelete, onRefresh }) {
    const update = (id, field, value) => setUsers((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
    return <section className="panel wide"><div className="panel-head"><h2>Registered Users</h2><button className="ghost" onClick={onRefresh}>Refresh</button></div><div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Action</th></tr></thead>
        <tbody>{users.map((managedUser) => <tr key={managedUser.id}>
            <td><input value={managedUser.name} onChange={(event) => update(managedUser.id, 'name', event.target.value)} /></td><td>{managedUser.email}</td><td><input value={managedUser.phone || ''} onChange={(event) => update(managedUser.id, 'phone', event.target.value)} /></td>
            <td><select value={managedUser.role} onChange={(event) => update(managedUser.id, 'role', event.target.value)}><option value="user">user</option><option value="admin">admin</option></select></td>
            <td className="actions"><button onClick={() => onSave(managedUser)}>Save</button><button className="danger" onClick={() => onDelete(managedUser.id)}>Delete</button></td>
        </tr>)}</tbody>
    </table></div></section>;
}

createRoot(document.getElementById('root')).render(<App />);
