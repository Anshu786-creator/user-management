# User Management System

Simple React + PHP + MySQL website for:

- User registration
- User login/logout
- Profile update
- Admin control for registered users

## XAMPP Setup

1. Start Apache and MySQL in XAMPP.
2. Copy this folder to `C:\xampp\htdocs\user-management-system`.
3. Open `http://localhost/user-management-system/setup.php`.
4. Open `http://localhost/user-management-system/index.html`.

Default admin:

- Email: `admin@example.com`
- Password: `admin123`

## Database

The setup page creates:

- Database: `user_management_app`
- Table: `users`

The project uses the default XAMPP MySQL login:

- User: `root`
- Password: empty

If your MySQL password is different, update `config.php`.
