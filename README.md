# LMS - Learning Management System

A modern Learning Management System built with React, Vite, Tailwind CSS, and Supabase. Designed for Ontario educators with support for the Ontario curriculum's 4-category grading framework.

## Features

### For Students
- **Registration with Unique ID**: Students receive a unique ID (STU-xxxxxxxx-xxxx format) upon registration
- **Student ID Display**: ID is prominently displayed on dashboard and profile with copy-to-clipboard functionality
- **Course Dashboard**: View enrolled courses with progress indicators
- **Class Roster**: View names of other students enrolled in the same course (privacy-protected - no access to grades/work)
- **Grade Viewing**: See overall grade with category breakdown (Knowledge & Understanding, Thinking, Application, Communication)

### For Teachers
- **Course Management**: Create and manage courses with customizable grading category weights
- **Student Enrollment**: Enroll students by entering their unique Student ID
- **Class Roster Management**: View all enrolled students with enrollment dates and grades
- **Module Organization**: Create modules and organize course content

### Technical Features
- **Row Level Security (RLS)**: Database-enforced security ensures students can only access their own data
- **Ontario Curriculum Grading**: Supports 4-category grading with weighted calculations
- **Evaluation Types**: Supports FOR Learning, AS Learning, and OF Learning assignments

## Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Routing**: React Router v7

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Plan
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database:

Run the SQL migrations in your Supabase dashboard:
- Go to SQL Editor in your Supabase project
- Copy and run the contents of `supabase/migrations/001_initial_schema.sql`

5. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components (Login, SignUp, AuthGuard)
│   ├── common/          # Common components (Layout, Modal, EmptyState, Tabs)
│   ├── course/          # Course-related components (tabs, roster)
│   └── dashboard/       # Dashboard components
├── contexts/            # React Context providers
│   └── AuthContext.jsx  # Authentication state management
├── pages/               # Page-level components
│   ├── Dashboard.jsx    # Main dashboard (routes to Teacher/Student)
│   ├── CourseView.jsx   # Course detail view with tabs
│   └── Profile.jsx      # User profile page
├── services/            # API service layer
│   ├── supabase.js      # Supabase client setup
│   ├── courses.js       # Course CRUD operations
│   ├── enrollments.js   # Enrollment operations
│   └── progress.js      # Progress tracking
└── App.jsx              # Main application with routing
```

## Database Schema

The application uses the following main tables:

- **profiles**: User profiles with role (teacher/student) and student_id
- **courses**: Course information with category weights
- **modules**: Course modules with ordering
- **content**: Module content (reading, video, assignment, quiz)
- **enrollments**: Student-course enrollments with cached grades
- **submissions**: Assignment submissions
- **grades**: Assignment grades with category scores

## Enrollment Flow

1. **Student Registration**: Student signs up and receives unique Student ID (STU-xxxxxxxx-xxxx)
2. **Share ID**: Student shares their ID with the teacher
3. **Teacher Enrollment**: Teacher enters Student ID in the Students tab
4. **Validation**: System validates the ID and shows student name for confirmation
5. **Enrollment**: Student is enrolled and immediately sees the course in their dashboard

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

The application is configured for deployment to Netlify:

1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy!

Build settings:
- Build command: `npm run build`
- Publish directory: `dist`

## License

MIT
