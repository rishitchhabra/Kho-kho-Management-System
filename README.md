# Kho Kho Premier League 🏃‍♂️

A modern web application for managing Kho Kho Premier League tournaments with teams, pools, matches, and user management.

## Features

- **Team Management**: Add, edit, delete teams with coach details
- **Pool System**: Organize teams into pools (separate for male/female)
- **Match Management**: Create matches, reorder schedule, track results
- **User Management**: Role-based access control with granular permissions
- **Dark Theme**: Modern UI with responsive design

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL + REST API)
- **Authentication**: Client-side session with Supabase users table

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kho-kho-premier-league.git
cd kho-kho-premier-league
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Update `backend/js/supabase-config.js`:

```javascript
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";
```

### 3. Set Up Database

Run the SQL in `backend/supabase-setup.sql` in your Supabase SQL Editor:
- Creates `teams`, `pools`, `matches`, and `admin_users` tables
- Sets up Row Level Security policies
- Creates default admin user

### 4. Run Locally

Simply open `frontend/index.html` in a browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

## Default Login

- **Username**: `admin`
- **Password**: `khokho2024`

## User Roles & Permissions

| Role | Description |
|------|-------------|
| **Admin** | Full access to all features including user management |
| **Editor** | Can manage teams, pools, and matches (no delete, no users) |
| **Viewer** | Read-only access to view teams, pools, and matches |

### Granular Permissions

Each module (Teams, Pools, Matches, Users) has specific actions that can be enabled/disabled per user:

- **Teams**: View, Add, Edit, Delete
- **Pools**: View, Add, Edit, Delete, Fix Matches
- **Matches**: View, Reorder, Complete, Delete
- **Users**: View, Add, Edit, Delete, Toggle Status

## Project Structure

```
kho-kho/
├── frontend/
│   ├── index.html          # Public home page
│   ├── admin.html          # Admin panel
│   ├── add-team.html       # Add team form
│   ├── login.html          # Login page
│   └── css/
│       ├── styles.css      # Home page styles
│       ├── admin.css       # Admin panel styles
│       └── form.css        # Form styles
├── backend/
│   ├── js/
│   │   ├── auth.js         # Authentication & permissions
│   │   ├── admin.js        # Admin panel logic
│   │   ├── home.js         # Home page logic
│   │   ├── teams.js        # Team CRUD operations
│   │   ├── add-team.js     # Add team form handler
│   │   └── supabase-config.js  # Supabase configuration
│   └── supabase-setup.sql  # Database schema
├── .gitignore
├── package.json
└── README.md
```

## License

MIT License - feel free to use this project for your tournaments!

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
