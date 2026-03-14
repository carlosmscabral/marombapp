# 📱 Product Requirements Document: MarombApp (Android Native)

## 1. Executive Summary
**MarombApp** is a premium, offline-first fitness application built natively for Android. It is designed to provide a frictionless, highly aesthetic workout experience. The app leverages a multi-tier user system (Admin, Trainer, Trainee) backed by Firebase/Firestore, while utilizing a robust local-first architecture (Room + WorkManager) to ensure zero interruptions during gym sessions, even in dead zones.

## 2. Target Personas & Roles
The system utilizes Firebase Authentication and Firestore Custom Claims (or role-based documents) to manage three distinct personas:

1. **Trainee (End User):**
   * Consumes workout plans (self-created or assigned by a Trainer).
   * Logs active sessions in the "In-Gym" interface.
   * Views personal analytics and exercise history.
2. **Trainer:**
   * Manages a roster of Trainees.
   * Creates, modifies, and assigns workout plans to specific Trainees.
   * Views analytics and progress (progressive overload) for their assigned Trainees.
3. **Admin:**
   * Manages the global "Library" of exercises (adding official videos, descriptions, and muscle group tags).
   * Manages user roles and system-wide configurations.

## 3. UX, Aesthetics, and Design System
The app follows Material Design 3 (MD3) principles but heavily customizes them to achieve a premium, dark-mode-first aesthetic.

### 3.1. Typography
* **Headlines & Numbers:** `Lexend` (Weights: 300 to 800). Used for large timers, PR weights, and screen titles. Provides a wide, technical, and modern feel.
* **Body & Labels:** `Plus Jakarta Sans` (Weights: 300 to 700). Used for secondary text, instructions, and micro-copy. Highly legible at small sizes.

### 3.2. Color Palette (Dark Theme Default)
* **Background:** Deep Navy (`#000e26`)
* **Surface Containers:** Low (`#00132f`), High (`#001f46`), Highest (`#002551`)
* **Primary (Blue):** `#6ab2ff` (Used for Chest/Shoulders, primary actions)
* **Secondary (Red):** `#ff716c` (Used for Back/Core, active states)
* **Tertiary (Yellow):** `#ffeb3b` (Used for Legs/Glutes, warnings/highlights)
* **Quaternary (Green):** `#4CAF50` (Used for success states, completion)
* **Signature 4-Color Bar:** A continuous 4px high horizontal bar containing equal segments of Primary, Secondary, Tertiary, and Quaternary colors. Used as a top border on cards and the active session header to reinforce brand identity.

### 3.3. Animations & Transitions (Jetpack Compose)
* **Screen Transitions:** Use Compose `SharedTransitionLayout` for hero elements (e.g., tapping an exercise in the Library expands the image into the detail screen). Standard screens use a subtle fade-through and slide-up transition.
* **Drag-and-Drop (Plan Screen):** Use spring physics (`spring(stiffness = Spring.StiffnessMediumLow)`) for lifting and dropping cards. The dragged card should elevate (increase shadow/tonal elevation) and slightly scale up (`scale(1.02f)`).
* **Active Set Pulse (In-Gym):** The currently active set row should have a continuous, subtle breathing glow (`InfiniteTransition` animating a drop shadow or border opacity).
* **Kinetic Rings (Analytics):** Circular progress indicators must animate their sweep angle on initial load using `tween(durationMillis = 1000, easing = FastOutSlowInEasing)`.

### 3.4. UI Components
* **Glassmorphism:** Use `Modifier.blur()` combined with semi-transparent surface colors (`rgba(0, 37, 81, 0.7)`) for the Bottom Navigation Bar and sticky headers.
* **Bento Grid:** Analytics and Plan summaries use a Bento Box layout with varying card spans, rounded corners (`12dp` to `16dp`), and subtle inner borders (`border-outline-variant/15`).

---

## 4. Core Features & Functional Requirements

### 4.1. In-Gym (Active Session) - *The "Sticky" Workout*
This is the most critical screen. It must never lose state.
* **Foreground Service:** When a workout starts, launch an Android `ForegroundService` with a persistent notification.
  * *Notification UI:* Shows the active rest timer, current exercise, and a "Complete Set" action button directly in the notification shade.
* **Process Death Resilience:** Every set logged, weight changed, or timer started is immediately written to the Room Database. If the OS kills the app, reopening it reads the `ActiveSession` from Room and resumes exactly where the user left off.
* **Rest Timers:** Floating or inline countdown timers that play a subtle audio chime/vibration upon completion.
* **Set Tracking:** Inline inputs for Weight (kg/lbs) and Reps. Auto-fills with data from the *previous* session's corresponding set.

### 4.2. Plan (Workout Builder)
* **Drag-and-Drop Interface:** Users can long-press and drag exercises to reorder them.
* **Super-sets:** Dragging one exercise slightly indented under another, or dropping it onto a "Link" drop-zone, visually groups them into a Super-set (indicated by a vertical connecting line and a link icon).
* **Trainer Integration:** Trainers see a dropdown to select a Trainee before building/assigning the plan. Trainees receive a push notification when a new plan is assigned.

### 4.3. Analytics
* **Muscle Group Distribution:** A custom Compose Canvas drawing a "Kinetic Ring" (segmented doughnut chart) showing the percentage of sets dedicated to Chest, Back, Legs, etc.
* **Progressive Overload Tracking:** Line charts (using a library like Vico or custom Canvas) showing 1RM (One Rep Max) estimations and volume load over time.
* **Trainer View:** Trainers can filter analytics by specific Trainees to monitor compliance and progress.

### 4.4. Library
* **Global vs. Custom:** Displays global exercises (managed by Admins) and custom exercises (created by the user or their Trainer).
* **Rich Media:** Supports looping MP4s or GIFs demonstrating the form.
* **Search & Filter:** Real-time search by name, muscle group, or equipment (Barbell, Dumbbell, Machine).

### 4.5. Localization
* **EN/PT Toggle:** A global toggle in the Top App Bar. Uses Android's native `LocaleManager` (Android 13+) or custom context wrapping for older versions to switch languages instantly without restarting the app.

---

## 5. Technical Architecture

### 5.1. Tech Stack
* **Language:** Kotlin
* **UI Toolkit:** Jetpack Compose (Material 3)
* **Architecture Pattern:** MVVM (Model-View-ViewModel) + Clean Architecture.
* **Concurrency:** Kotlin Coroutines & StateFlow.
* **Dependency Injection:** Hilt.

### 5.2. Offline-First Synchronization Strategy
The app must function 100% offline.
1. **Local Source of Truth:** The UI *only* observes data from the local Room Database via `Flow<T>`.
2. **Write Path:** User actions (e.g., logging a set) write directly to Room.
3. **Sync Path:** 
   * Upon writing to Room, a `WorkManager` task is enqueued (`OneTimeWorkRequest` with `NetworkType.CONNECTED` constraint).
   * The Worker pushes the local changes to Firestore.
4. **Read Path:** Firestore `SnapshotListeners` run when the app is in the foreground (and online). Incoming remote changes (e.g., a Trainer assigning a plan) are written to Room. Room then emits the new data to the UI.

### 5.3. Firebase / Firestore Data Model (High Level)

* **`users/{userId}`**
  * `role`: "admin" | "trainer" | "trainee"
  * `trainerId`: Reference to a trainer (if this user is a trainee).
* **`exercises/{exerciseId}`** (Global Library)
  * `name`, `muscleGroup`, `equipment`, `videoUrl`, `isCustom`, `creatorId`.
* **`routines/{routineId}`**
  * `ownerId` (Trainee ID), `creatorId` (Trainer or Trainee ID).
  * `name`, `targetVolume`.
  * `blocks`: Array of objects (can be single exercises or super-sets).
* **`sessions/{sessionId}`**
  * `userId`, `routineId`, `startTime`, `endTime`, `status` (active/completed).
  * `logs`: Subcollection of sets performed (exerciseId, weight, reps, timestamp).

### 5.4. Security Rules (Firestore)
* **Trainees** can only read/write their own `routines` and `sessions`.
* **Trainers** can read/write `routines` and read `sessions` for users where `users/{traineeId}.trainerId == request.auth.uid`.
* **Admins** have global read/write access to the `exercises` collection.

---

## 6. Edge Cases & Error Handling
1. **Process Death during Rest Timer:** The `ForegroundService` handles the timer. If the service is killed by the system (extreme memory pressure), the app calculates the elapsed time upon reboot by comparing `System.currentTimeMillis()` against the `timerStartTime` saved in Room.
2. **Sync Conflicts:** If a Trainee modifies a routine offline, and the Trainer modifies it online simultaneously, implement a "Last Write Wins" strategy based on a `updatedAt` timestamp, or branch the routine into a "Customized" version.
3. **Missing Video Assets:** If offline, the Library should display a cached placeholder image (using Coil's disk caching) instead of a broken video player.
