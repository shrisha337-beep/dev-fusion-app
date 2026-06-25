# SplitSmart 🚀

SplitSmart is a group expense-splitting mobile application built with the Indian college student context at its core. Whether it's flatmates splitting monthly rent and utilities, friends splitting a Goa trip, or classmates splitting Swiggy orders, SplitSmart makes group finances clean, transparent, and drama-free.

---

## 📱 Standalone Android APK Download

You can download the compiled standalone Android APK directly to test on your device (no Expo Go required!):

🔗 **[Download SplitSmart Standalone APK](https://expo.dev/accounts/shri04/projects/splitsmart/builds/da7218c2-fb5a-490d-b3c6-359e2757571b)**

---

## 💡 The Problem We Solved

Every college student has experienced the chaos of tracking shared expenses. The usual workflow involves a messy combination of Excel sheets, screenshot spams in WhatsApp groups, manual calculator checks, awkward "bhai paise de de" conversations, and copy-pasting UPI IDs. 

SplitSmart eliminates all of this friction by providing:
1. **Zero-friction logging**: Fast expense entries with support for complex group split conditions.
2. **DSA-driven simplification**: Minimizes the number of actual transactions required to settle the entire group, removing circular debts.
3. **Frictionless payments**: Generates one-tap native mobile UPI intents to launch payment apps directly with pre-filled details.
4. **Dispute prevention**: Double-entry confirmation flow where paid transactions remain "Pending" until the recipient confirms receipt.

---

## 🛠️ The Tech Stack (What, Why & How)

### 1. Mobile Framework: React Native + Expo (v56) + TypeScript
*   **What**: A declarative framework for compiling cross-platform mobile apps using React, paired with TypeScript for static type-safety.
*   **Why**: Rapid prototyping, robust hot-reloading (critical for hackathon speed), native performance, and easy compilation to standalone APKs.
*   **How**: Developed using Expo v56 SDK, structuring modular screens (Group Selection, Ledger, Form splits, History, Recurring scheduler) in TypeScript.

### 2. Styling: twrnc (Tailwind React Native Classnames)
*   **What**: A utility-first runtime style parser matching Tailwind CSS class syntax for React Native.
*   **Why**: Setting up PostCSS and NativeWind compilers inside Expo projects can run into Babel transpile mismatches on Windows systems. `twrnc` offers a zero-config, compile-safe alternative with 100% Tailwind utility support.
*   **How**: Styled cards, badges, modal sheets, and layouts dynamically using the runtime parser (e.g., `style={tw`bg-indigo-600 rounded-2xl shadow-md p-4`}`).

### 3. Database & Real-Time Sync: Local AsyncStorage + Firebase Firestore
*   **What**: AsyncStorage (key-value client database) combined with Firestore (NoSQL cloud database).
*   **Why**: Supports seamless offline usage (useful for travel/poor networks). If Firebase configs are present in `.env`, the app syncs real-time changes across all group members. If absent, the app falls back gracefully to offline-only AsyncStorage so it remains 100% functional.
*   **How**: Updates are written locally first for instantaneous UI rendering, then synced to Firestore. The app listens to live document changes using Firestore `onSnapshot` to sync updates to other roommates.

### 4. DSA Engine: Greedy Graph Debt Simplification
*   **What**: A greedy graph-based algorithm to solve the multi-source, multi-sink balance settlement problem.
*   **Why**: In a group of $N$ friends, basic splitting creates up to $N(N - 1)$ transactions. Our DSA engine reduces this to the mathematical minimum (worst case $N - 1$) by canceling out intermediate transactions.
*   **How**: 
    1. Computes the net balance of each user: $\text{Net Balance} = \text{Amount Paid} - \text{Amount Owed}$.
    2. Filters out members with a net balance of $0$.
    3. Segregates members into a **Debtors** list (negative balance) and a **Creditors** list (positive balance).
    4. Recursively matches the largest debtor with the largest creditor, records a settlement transaction, and updates their remaining balances until all positions reach $0$.

### 5. Native Payments: Mobile UPI Intent API & SVGs
*   **What**: Deep-linking standard (`upi://pay`) combined with vector QR code generation.
*   **Why**: Copy-pasting phone numbers or searching contact lists creates payment friction. Tapping "Settle Up" triggers the OS system sheet, allowing you to choose GPay, PhonePe, Paytm, or BHIM with the payee's UPI ID, name, note, and amount pre-filled.
*   **How**: Uses React Native `Linking` for launching URIs, and `react-native-qrcode-svg` to display fallback payment codes on-screen.

### 6. Document Generation: expo-print + expo-file-system + expo-sharing
*   **What**: Client-side document assembly and system share sheets.
*   **Why**: Group transparency requires exporting logs to spreadsheet formats (CSV) or printable files (PDF).
*   **How**: CSV is written as raw comma-separated text using `expo-file-system/legacy`. PDF is compiled from a clean, CSS-styled HTML template using `expo-print`'s print-to-file capability. Both files are shared instantly via native sharing prompts.

---

## 🏃 How to Run Locally

Follow these steps to run the code on your local development machine:

### Prerequisites
*   Node.js (v18 or higher)
*   Expo Go app installed on your physical Android or iOS device (download from Google Play Store or App Store)

### Step-by-Step Launch
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/shrisha337-beep/dev-fusion-app.git
    cd dev-fusion-app
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the Expo server**:
    ```bash
    npm run start
    ```
4.  **Connect your phone**:
    *   Once the Metro bundler runs, it will print a large **QR Code** in your terminal.
    *   Open your phone's camera (iOS) or the **Expo Go** app (Android) and scan the QR code to run the application instantly.
5.  *(Optional)* **Test the DSA logic**:
    You can execute the standalone unit tests for the Debt Simplifier module using:
    ```bash
    npx tsx src/tests/testSimplifier.ts
    ```

---

## 🎯 Key Features Included
*   **Group Invite Code**: Join flat/trip groups with a single 6-digit alphanumeric code.
*   **Split Types**: Equal splits, exact rupee amounts, split by percentages, or split by ratios/shares.
*   **Auto-Trigger Scheduler**: Logs recurring bills (Netflix, rent) automatically when dates pass. Includes a manual check tool for testing.
*   **Pending Approval Status**: Settle-ups must be approved by the payee, blocking false claims.
*   **Export Center**: Share PDF sheets and CSV tables directly to WhatsApp or Google Drive.
