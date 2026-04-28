const { useEffect, useState } = React;

const emptyAuth = { name: '', email: '', phone: '', password: '' };

function App() {
    const [user, setUser] = useState(null);
    const [screen, setScreen] = useState('login');
    const [authForm, setAuthForm] = useState(emptyAuth);
    const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '' });
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        api('api/auth.php?action=me').then((data) => {
            if (data.user) {
                setUser(data.user);
                setProfileForm({ name: data.user.name, phone: data.user.phone || '', password: '' });
                if (data.user.role === 'admin') loadUsers();
            }
        });
    }, []);

    async function api(url, body) {
        const options = body
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            : {};
        const response = await fetch(url, options);
        return response.json();
    }

    function updateAuth(field, value) {
        setAuthForm((form) => ({ ...form, [field]: value }));
    }

    async function submitAuth(event) {
        event.preventDefault();
        const data = await api(`api/auth.php?action=${screen}`, authForm);
        setMessage(data.message || '');

        if (data.ok && screen === 'login') {
            setUser(data.user);
            setProfileForm({ name: data.user.name, phone: data.user.phone || '', password: '' });
            if (data.user.role === 'admin') loadUsers();
        }

        if (data.ok && screen === 'register') {
            setScreen('login');
            setAuthForm(emptyAuth);
        }
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

    async function logout() {
        await api('api/auth.php?action=logout');
        setUser(null);
        setUsers([]);
        setAuthForm(emptyAuth);
        setScreen('login');
        setMessage('Logged out.');
    }

    async function loadUsers() {
        const data = await api('api/admin.php?action=list');
        if (data.ok) setUsers(data.users);
    }

    async function updateManagedUser(nextUser) {
        const data = await api('api/admin.php?action=update', nextUser);
        setMessage(data.message || '');
        loadUsers();
    }

    async function deleteUser(id) {
        if (!confirm('Delete this user?')) return;
        const data = await api('api/admin.php?action=delete', { id });
        setMessage(data.message || '');
        loadUsers();
    }

    if (!user) {
        return (
            <main className="auth-page">
                <section className="auth-panel">
                    <div>
                        <p className="eyebrow">React + PHP + MySQL</p>
                        <h1>User Management</h1>
                        <p className="subtitle">Login, registration, profile updates, and admin user control.</p>
                    </div>

                    <div className="tabs">
                        <button className={screen === 'login' ? 'active' : ''} onClick={() => setScreen('login')}>Login</button>
                        <button className={screen === 'register' ? 'active' : ''} onClick={() => setScreen('register')}>Register</button>
                    </div>

                    <form onSubmit={submitAuth} className="form">
                        {screen === 'register' && (
                            <>
                                <label>Name<input value={authForm.name} onChange={(e) => updateAuth('name', e.target.value)} required /></label>
                                <label>Phone<input value={authForm.phone} onChange={(e) => updateAuth('phone', e.target.value)} /></label>
                            </>
                        )}
                        <label>Email<input type="email" value={authForm.email} onChange={(e) => updateAuth('email', e.target.value)} required /></label>
                        <label>Password<input type="password" value={authForm.password} onChange={(e) => updateAuth('password', e.target.value)} required /></label>
                        <button className="primary" type="submit">{screen === 'login' ? 'Login' : 'Create Account'}</button>
                    </form>

                    {message && <p className="message">{message}</p>}
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

            {message && <p className="message">{message}</p>}

            <section className="grid">
                <div className="panel">
                    <h2>Profile Update</h2>
                    <form onSubmit={saveProfile} className="form">
                        <label>Name<input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required /></label>
                        <label>Email<input value={user.email} disabled /></label>
                        <label>Phone<input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></label>
                        <label>New Password<input type="password" value={profileForm.password} onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="Leave blank to keep current password" /></label>
                        <button className="primary" type="submit">Save Profile</button>
                    </form>
                </div>

                {user.role === 'admin' && (
                    <div className="panel wide">
                        <div className="panel-head">
                            <h2>Registered Users</h2>
                            <button className="ghost" onClick={loadUsers}>Refresh</button>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {users.map((row) => (
                                        <tr key={row.id}>
                                            <td><input value={row.name} onChange={(e) => setUsers(users.map((u) => u.id === row.id ? { ...u, name: e.target.value } : u))} /></td>
                                            <td>{row.email}</td>
                                            <td><input value={row.phone || ''} onChange={(e) => setUsers(users.map((u) => u.id === row.id ? { ...u, phone: e.target.value } : u))} /></td>
                                            <td>
                                                <select value={row.role} onChange={(e) => setUsers(users.map((u) => u.id === row.id ? { ...u, role: e.target.value } : u))}>
                                                    <option value="user">user</option>
                                                    <option value="admin">admin</option>
                                                </select>
                                            </td>
                                            <td className="actions">
                                                <button onClick={() => updateManagedUser(row)}>Save</button>
                                                <button className="danger" onClick={() => deleteUser(row.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
