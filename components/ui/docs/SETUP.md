# BIOTECHCENTRE - Setup Guide

This document provides instructions to set up the Supabase backend and the local React development environment.

## 1. Supabase Project Setup

1.  **Create a Supabase Account:** If you don't have one, sign up at [supabase.com](https://supabase.com).
2.  **Create a New Project:**
    *   Go to your Supabase dashboard and click "New project".
    *   Give your project a name (e.g., `biotechcentre-app`).
    *   Generate a secure database password and save it somewhere safe.
    *   Choose a region closest to your users.
    *   Click "Create new project". Wait for the project to be provisioned.
3.  **Get API Keys:**
    *   Navigate to **Project Settings** (the gear icon in the left sidebar).
    *   Go to the **API** section.
    *   You will find your **Project URL** and `anon` **public** key. You will need these for the React application.
4.  **Run the SQL Schema:**
    *   Navigate to the **SQL Editor** in the left sidebar.
    *   Click "+ New query".
    *   Copy the entire content from `components/ui/docs/SCHEMA.sql` and paste it into the editor.
    *   Click **RUN**. This will create all the necessary tables, types, and functions.
5.  **Enable Row Level Security (RLS):**
    *   The provided schema enables RLS on all tables but does not yet define policies.
    *   Navigate to **Authentication** -> **Policies**.
    *   For each table, you need to add policies. For example, to allow authenticated users to see their own data:
        ```sql
        -- Example Policy: Allow users to see their own products.
        CREATE POLICY "Enable read access for authenticated users"
        ON public.products FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);

        -- Example Policy: Allow users to insert their own products.
        CREATE POLICY "Enable insert for authenticated users"
        ON public.products FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
        ```
    *   You will need to create appropriate policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for all tables based on your application's security requirements.

## 2. React Application Setup

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd biotechcentre-app
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Create Environment File:**
    *   Create a file named `.env.local` in the root of your project directory.
    *   Add your Supabase Project URL and Anon Key to this file:
        ```
        VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
        VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        ```
    *   Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with the values from your Supabase project settings.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application should now be running on `http://localhost:5173` (or another port if 5173 is in use).

## 3. Tech Stack

*   **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn-ui (concepts), React Query, React Hook Form, React Router DOM (`HashRouter`), Recharts.
*   **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime).

You are now ready to start developing!