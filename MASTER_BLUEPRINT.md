# AB Manager - Master Blueprint

## 1. Project Overview
**Name:** AB Manager (formerly Al Berakah Vault Pro)
**Description:** A complete, cloud-based business management system designed specifically for SMEs in the UAE. It integrates financial tracking, inventory management, cheque lifecycle management, and advanced AI-powered tools into a single, cohesive platform.
**Target Audience:** Small to Medium Enterprises (SMEs) operating in the UAE requiring robust financial and operational oversight.

## 2. Core Modules & Features

### 2.1. Dashboard
*   **Purpose:** Provides a high-level overview of the business's current state.
*   **Key Metrics Displayed:**
    *   Today's Income & Expenses (Cash, Card, Online, Cheque).
    *   Pending Cheques (Incoming & Outgoing).
    *   Low Stock Alerts.
    *   Recent Transactions.
*   **Visualizations:** Interactive charts (using Recharts) showing income vs. expense trends over time.

### 2.2. Petty Cash Management
*   **Purpose:** Track daily cash flow, income, and expenses.
*   **Features:**
    *   Record Income and Expenses.
    *   Categorize transactions (e.g., Sales, Utilities, Salaries).
    *   Track payment methods (Cash, Card, Online, Cheque, Credit).
    *   Daily Closing Summary: Reconcile end-of-day balances and generate a summary report.
    *   Shareable Reports: Export daily summaries directly to WhatsApp.

### 2.3. Cheque Management
*   **Purpose:** Manage the complete lifecycle of incoming and outgoing cheques, a critical business function in the UAE.
*   **Features:**
    *   Record Incoming (Receivable) and Outgoing (Payable) cheques.
    *   Track Cheque Status: Pending, Deposited, Cleared, Bounced, Cancelled, Replaced.
    *   Due Date Tracking: Visual indicators for upcoming and overdue cheques.
    *   Bank Management: Track which banks cheques are drawn from/deposited to.

### 2.4. Stock & Inventory
*   **Purpose:** Real-time tracking of product inventory, costs, and profitability.
*   **Features:**
    *   Product Catalog: Manage items with SKU, Category, and Unit types.
    *   Stock Movements: Track Stock In (Purchases/Returns) and Stock Out (Sales/Damage).
    *   Profitability Analysis: Calculate Profit per Unit and Profit Margins based on Cost vs. Selling Price.
    *   Low Stock Alerts: Visual warnings when items fall below their defined reorder levels.

### 2.5. AI Studio (Powered by Gemini & Veo)
*   **Purpose:** A centralized hub for advanced artificial intelligence capabilities.
*   **Features:**
    *   **Smart Chat (Pro):** Complex reasoning and multimodal analysis using `gemini-3.1-pro-preview`.
    *   **Fast Chat (Flash-Lite):** Quick, low-latency responses using `gemini-3.1-flash-lite-preview`.
    *   **Deep Think:** Multi-step problem solving using `gemini-3.1-pro-preview` with `ThinkingLevel.HIGH`.
    *   **Web Search:** Real-time internet access using `gemini-3-flash-preview` with Google Search grounding.
    *   **Maps Data:** Location intelligence using `gemini-2.5-flash` with Google Maps grounding.
    *   **Image Studio:** High-quality image generation (1K, 2K, 4K) using `gemini-3-pro-image-preview` and `gemini-3.1-flash-image-preview`.
    *   **Video Studio:** AI video generation from text or images using `veo-3.1-fast-generate-preview`.

### 2.6. Marketing Automation (n8n Integration Ready)
*   **Purpose:** Automate customer outreach and promotional campaigns.
*   **Features:**
    *   Campaign Management: Draft, schedule, and track marketing campaigns.
    *   Multi-channel Support: WhatsApp, Instagram, Facebook.
    *   AI Content Generation: Draft promotional messages in multiple languages (English, Arabic, Hindi, Urdu).

### 2.7. Reminders & Tasks
*   **Purpose:** Keep track of pending payments, tasks, and follow-ups.
*   **Features:**
    *   Automated reminders for pending cheques and overdue credit payments.
    *   Direct WhatsApp integration to send payment reminders to clients.

## 3. Technical Architecture

### 3.1. Frontend Stack
*   **Framework:** React 18 (Functional Components, Hooks).
*   **Build Tool:** Vite.
*   **Language:** TypeScript for strict type safety.
*   **Styling:** Tailwind CSS (Utility-first CSS framework).
*   **Animations:** Framer Motion (Page transitions, modal animations).
*   **Icons:** Lucide React.
*   **Charts:** Recharts (Responsive, composable charting library).
*   **Routing:** React state-based conditional rendering (Single Page Application architecture).

### 3.2. Backend & Database (Firebase)
*   **Authentication:** Firebase Auth (Google Sign-In provider). Ensures secure access and user-scoped data.
*   **Database:** Cloud Firestore (NoSQL Document Database).
*   **Real-time Sync:** Uses `onSnapshot` listeners for real-time UI updates across all connected clients.
*   **Security:** Firestore Security Rules enforce data isolation (users can only read/write their own data based on `uid`).

### 3.3. AI Integration
*   **SDK:** `@google/genai`
*   **Authentication:** 
    *   Text/Basic models: System-injected API key.
    *   Advanced Image/Video models: User-provided Google Cloud API key via secure popup (`window.aistudio.openSelectKey()`).

## 4. Database Schema (Firestore)

The database is structured into several top-level collections, with every document secured by a `uid` field linking it to the authenticated user.

### Collections:
1.  **`petty_cash`**: Daily transactions.
    *   Fields: `date`, `type` (income/expense), `amount`, `category`, `payment_method`, `status`, `uid`.
2.  **`daily_summaries`**: End-of-day reconciliations.
    *   Fields: `date`, `opening_balance`, `closing_balance`, `total_sales`, `uid`.
3.  **`cheques`**: Cheque records.
    *   Fields: `cheque_type` (incoming/outgoing), `payee_name`, `amount`, `date`, `due_date`, `bank_name`, `status`, `uid`.
4.  **`stock_items`**: Inventory catalog.
    *   Fields: `name`, `sku`, `category`, `current_stock`, `reorder_level`, `cost_price`, `selling_price`, `uid`.
5.  **`stock_movements`**: Ledger of inventory changes.
    *   Fields: `stock_item_id`, `type` (in/out), `quantity`, `date`, `uid`.
6.  **`marketing_campaigns`**: Marketing data.
    *   Fields: `title`, `type`, `platform`, `content`, `status`, `uid`.
7.  **`app_settings`**: User preferences.
    *   Fields: `business_name`, `currency`, `timezone`, `uid`.

## 5. Security & Permissions
*   **Authentication Required:** The entire application is wrapped in an Auth guard. Unauthenticated users are redirected to the Login screen.
*   **Data Isolation:** Firestore rules dictate `allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;` (or similar logic) ensuring users cannot access other businesses' data.
*   **API Key Security:** Third-party API keys for advanced AI models are handled client-side via secure platform dialogs, never hardcoded or stored in plain text in the database.

## 6. Future Roadmap / Expansion Possibilities
*   **Multi-User Support:** Implement Role-Based Access Control (RBAC) to allow Admin, Manager, and Cashier roles within the same business account.
*   **Invoice Generation:** Add a module to generate, print, and email PDF invoices directly from the app.
*   **n8n Webhook Integration:** Fully connect the Marketing module to an active n8n instance for actual message dispatching.
*   **Barcode Scanning:** Integrate device camera to scan barcodes for faster stock movements and checkout.
