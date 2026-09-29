# AuraRide — Frontend Web Client

The AuraRide frontend is a modern, high-performance single-page web application built with **React 19**, **Vite 8**, **Tailwind CSS**, and **Leaflet / React-Leaflet**.

For the complete project architecture, algorithmic explanations (Dijkstra, A*, QuadTree, Min-Heap), API documentation, and testing reports, please refer to the primary repository documentation:
👉 **[Main AuraRide Documentation](../README.md)**

---

## Key Features & UI Modules

- **Rider Dashboard (`/`)**:
  - Full-screen interactive dark map with real-time pickup/dropoff marker positioning.
  - Global address search powered by OpenStreetMap Nominatim geocoding.
  - Multi-tier vehicle fare estimations with dynamic surge pricing.
  - Real-time driver trip progress tracking over calculated shortest-path polylines.
  - Interactive Algorithmic Benchmark modal comparing Dijkstra vs. A* Search.

- **Driver Portal (`/driver`)**:
  - Online/offline availability switch broadcasting GPS coordinates to backend QuadTree.
  - Real-time incoming ride dispatch notifications with instant accept/reject capability.
  - Automated transit simulation along road network waypoints.

- **Admin Central Command (`/admin`)**:
  - RBAC-protected operational dashboard with real-time telemetry metrics.
  - Gross platform revenue and completed ride counters.
  - Driver verification management and abusive account suspension switches.

---

## Frontend Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```ini
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Development Server
```bash
npm run dev
# Running at http://localhost:5173
```

### 4. Production Build
```bash
npm run build
```
The compiled output is output to `dist/`.
