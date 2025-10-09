# GST Management System

A comprehensive GST management system for Indian businesses built with React, TypeScript, and Supabase. It includes modules for inventory, customer, purchase, and invoice management, along with reporting and analytics.

## Features

- Dashboard with key metrics and sales overview.
- Invoice Management: Create, edit, delete, and print invoices.
- Inventory Control: Manage products, stock levels, and tax rates.
- Customer Relationship Management: Keep track of customer details.
- Purchase Tracking: Log purchases to manage stock and costs.
- Responsive design for use on desktop and mobile devices.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn-ui (concepts), React Query, React Hook Form, React Router DOM (`HashRouter`), Recharts.
- **Backend:** Supabase (PostgreSQL, Auth, Storage).

---

## Local Development Setup

### 1. Supabase Project Setup

1.  **Create a Supabase Account:** If you don't have one, sign up at [supabase.com](https://supabase.com).
2.  **Create a New Project:**
    *   Go to your Supabase dashboard and click "New project".
    *   Give your project a name (e.g., `gst-management-system`).
    *   Generate a secure database password and save it.
    *   Choose a region closest to your users.
3.  **Get API Keys:**
    *   Navigate to **Project Settings** (gear icon) -> **API**.
    *   Note your **Project URL** and `anon` **public** key.
4.  **Run the SQL Schema:**
    *   Navigate to the **SQL Editor**.
    *   Copy the entire content from `components/ui/docs/SCHEMA.sql` and paste it into a new query.
    *   Click **RUN**. This creates all necessary tables and functions.
5.  **Enable Row Level Security (RLS):**
    *   The schema enables RLS but doesn't define policies. You must add appropriate policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all tables to secure your data. Refer to the Supabase documentation for creating RLS policies.

### 2. React Application Setup

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd gst-management-system
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Create Environment File:**
    *   The application's Supabase client in `lib/supabase.ts` is currently hardcoded for demonstration purposes. For local development, you should create a file named `.env.local` in the root of your project directory and add your credentials. You would then modify `lib/supabase.ts` to use these environment variables.
        ```env
        VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
        VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        ```
    *   Replace the placeholder values with your actual Supabase Project URL and Anon Key.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be running on `http://localhost:5173`.

---

## Deployment to Netlify

This project can be easily deployed using [Netlify](https://www.netlify.com/).

1.  **Push to a Git Repository:**
    Make sure your project is pushed to a repository on GitHub, GitLab, or Bitbucket.

2.  **Sign up & Connect:**
    *   Create an account on [Netlify](https://app.netlify.com/signup) or log in.
    *   Click the **"Add new site"** button and choose **"Import an existing project"**.
    *   Connect to your Git provider.

3.  **Select Repository:**
    *   Choose the repository for your GST management system.

4.  **Configure Build Settings:**
    Netlify will likely auto-detect that you are using Vite. If not, use the following settings:
    *   **Build command:** The project is configured to work with modern bundlers, but does not have a build script configured in `package.json`. You would typically use `vite build`.
    *   **Publish directory:** `dist`

5.  **Add Environment Variables:**
    This is the most important step to connect your frontend to Supabase.
    *   Go to **Site settings > Build & deploy > Environment**.
    *   Click **"Edit variables"** and add the following two variables:
      *   **Key:** `VITE_SUPABASE_URL`
      *   **Value:** `YOUR_SUPABASE_PROJECT_URL` (The one currently hardcoded in `lib/supabase.ts`)
      *   **Key:** `VITE_SUPABASE_ANON_KEY`
      *   **Value:** `YOUR_SUPABASE_ANON_KEY` (The one currently hardcoded in `lib/supabase.ts`)

6.  **Deploy Site:**
    *   Click the **"Deploy site"** button. Netlify will start the build process and deploy your application. Once complete, you will be given a live URL.

---

## Known Issues & Future Improvements

This starter project has areas that can be improved for a production-ready application. Key points include:

-   **SKU Uniqueness:** Needs better handling for `null` or empty SKU values.
-   **Inefficient Triggers:** Invoice and stock calculation triggers could be optimized for performance.
-   **Incomplete RLS:** A comprehensive set of Row Level Security policies is required for data security.
-   **Limited Data Validation:** More robust server-side validation (e.g., for GSTIN format, non-negative prices) should be added.
-   **Basic PDF Generation:** The current `window.print()` functionality for invoices could be replaced with a more robust PDF generation library for better control over the output.

For more details, see `components/ui/docs/KNOWN_ISSUES.md`.
