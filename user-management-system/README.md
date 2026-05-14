# User Management System

Simple offline-friendly PHP + MySQL website for:

- User registration
- User login/logout
- Profile update
- Admin control for registered users
- Computer inventory details
- Printer inventory details
- User product add requests with admin approval
- Admin request approve/delete workflow
- Master configuration for product dropdown fields
- Local network use without internet

## XAMPP Setup

1. Start Apache and MySQL in XAMPP.
2. Copy this folder to `C:\xampp\htdocs\user-management-system`.
3. Open `http://localhost/user-management-system/setup.php`.
4. Open `http://localhost/user-management-system/index.html`.
5. From another computer on the same network, open `http://YOUR-SERVER-IP/user-management-system/index.html`.

Default admin:

- Email: `admin@example.com`
- Password: `admin123`

## Database

The setup page creates:

- Database: `user_management_app`
- Table: `users`
- Table: `inventory_items`
- Table: `inventory_requests`
- Table: `master_options`

The project uses the default XAMPP MySQL login:

- User: `root`
- Password: empty

If your MySQL password is different, update `config.php`.

## Local Network Notes

- Keep Apache and MySQL running in XAMPP on the server computer.
- Allow Apache through Windows Firewall for private networks.
- Find the server IP with `ipconfig`.
- Use that IP from other computers connected to the same Wi-Fi/LAN.
