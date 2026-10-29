# Arch-E-Tech

Arch-E-Tech turns a sentence like *"3 bedroom house, open kitchen, 1800 sq ft, two floors with a balcony"* into a complete, editable house: a 2D floor plan, a 3D model you can walk through, the house on its street, photos of every room, and a live cost estimate. You can then change the plan with drawing tools or by typing what you want changed.

- **Frontend:** React 19 + Vite, Tailwind CSS v4, fabric.js (2D plan), three.js with react-three-fiber and drei (3D). Deployed on **Vercel**.
- **Backend:** FastAPI + SQLAlchemy, Groq LLM for planning and advice, Cloudflare Workers AI (FLUX.2 Klein) for room photos. Deployed on **Render**.
- **Database:** Supabase Postgres in production, a local SQLite file in development.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Project structure](#project-structure)
4. [Running it locally](#running-it-locally)
5. [Environment variables](#environment-variables)
6. [Deployment](#deployment)
7. [API reference](#api-reference)
8. [Plan data format](#plan-data-format)
9. [Units, currency and settings](#units-currency-and-settings)
10. [Troubleshooting](#troubleshooting)

---

## Features

### Landing page and accounts
- Landing page with a continuous animation of the design engine (prompt → plan → model → render).
- Email and password accounts (bcrypt-hashed passwords, JWT sessions).

### Dashboard
- All your projects with a plan thumbnail, built-up area, room count and estimated cost. Each stat has a short explanation.
- Open a project in the Studio, its Overview, or Photo Render. Duplicate and delete projects.
- **Saved Photos:** every room photo you keep, which you can rename, regenerate or delete.
- **Settings:** area in sq ft or m², money in ₹ (INR), $ (USD) or € (EUR).

### Generating a plan from a prompt
Write the house you want in plain English. The prompt is read for:
- number of bedrooms (exactly what you ask for), kids' bedrooms, guest bedroom, master suite
- bathrooms, an extra common bathroom, a powder room
- open or closed kitchen
- total area in sq ft or m²
- number of floors and how bedrooms split between them (2-1, 1-2, 2-2 …)
- balcony, patio, study and other rooms

The planner picks similar reference houses, asks the LLM to design a new layout, then cleans and validates it. Bedrooms are spread around the house rather than lined up. If the LLM's answer is unusable, a reference plan is adapted instead, so a plan is always produced.

### Multi-floor houses
- Rooms are split across floors, with stairs placed to line up on both levels.
- Balconies and patios get railings automatically.
- In 3D the floors are stacked into one house, with stair openings cut through the slabs, and you can switch between floors or show them all.

### The Studio (2D editor)
- Draw walls, doors, windows, stairs and railings. Place furniture from the library.
- **Smart Snap:** walls snap to each other's ends, to right angles and to the grid.
- **Auto Detect:** finds the rooms enclosed by your walls and labels them.
- **AI Layout:** generate or regenerate the layout from a prompt while you are in the Studio.
- **AI Edit:** a popup at the bottom of the grid where you type changes like "make this door narrower", "extend the north wall by 1 m", or "remove the study". The LLM returns a small list of updates, deletions and additions, so nothing else in the plan changes.
- **Rooms:** rename rooms and see each room's area.
- **Material Painter:** apply textures to walls and floors; click another texture to switch directly.
- Undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), autosave to the server with a sync indicator.
- Both side panels can be hidden for a full-screen view. The Studio remembers your choice.
- **(i) tips** next to each feature explain what it does.

### Feature dock
A panel that slides in from the right edge of the Studio and collapses to a slim **FEATURES** tab:

| Group   | Feature        | What it does |
|---------|----------------|--------------|
| View    | Walkthrough    | First-person walk through the rooms at eye level (WASD + mouse) |
| View    | Immersive View | The house on a landscaped plot in a neighbourhood, with time of day, weather and roof options |
| View    | Overview       | A presentation: floor plans, 3D model, every room, photos and the cost takeoff |
| AI      | Photo Render   | A photo of every room, empty and then furnished, all in the same house style |
| AI      | Concept Viz    | A 3D cutaway or exterior concept image of the whole house |
| AI      | Budget Advisor | Enter your budget; get ranked suggestions on where to cut back |
| Reports | Cost takeoff   | The live estimate, item by item |
| Reports | PDF Report     | Plan, costs and notes as a PDF |

### 3D view
- Walls with real window and door openings, glass, textured materials, furniture, ceilings and lights.
- Flat or pitched roof, or no roof to look inside.
- Camera distance adapts to the size of the house.

### Photo Render
1. Each room is first photographed **empty**, from one shared "house identity" (floors, walls, ceiling, window frames, light, the view outside). Rooms already photographed are passed in as reference images, so the whole house looks consistent.
2. That empty photo is then used as the reference for the **furnished** version, so you get the same room furnished the way your prompt describes.
3. You can also upload your own photo of a room to furnish it.
4. Keep any photo in Saved Photos.

### Budget Advisor
1. Enter a budget, or tap 20 L, 30 L, 50 L or 1 Cr. It is remembered per project.
2. A bar compares the current estimate with the budget.
3. **Find where to save** returns 4 to 7 ranked cuts, each with a rough saving and an impact level. The largest savings for the least change to daily life come first.
4. Tick the cuts you accept and the new total updates. The gentlest cuts are pre-ticked until the gap is covered.
5. Cuts that change the drawing (e.g. "remove the bathtubs") have **Apply to plan**, which runs through AI Edit and can be undone.

Groq writes the advice when `GROQ_API_KEY` is set. Without it, rule-based cuts are worked out from the takeoff, so the feature always answers. Savings come from the app's simplified takeoff and are a guide, not a contractor quote.

### Cost takeoff
`client/src/utils/costs.js` prices walls by length, doors, windows, stairs, railings and each furniture and fitting type. The total updates live as you edit and is shown in the chosen currency.

---

## How it works

```
 prompt ──► parse_prompt ──► build_program ──► plan_designer ──────────► multi_floor ──► elements JSON
           (bedrooms, baths,   (rooms + sizes     (reference plans +        (split floors,     (walls, doors,
            kitchen, area,      to fit the area)   Groq LLM layout,          stairs, railings,  windows, rooms,
            floors, extras)                        validate / adapt)         balcony)           furniture)
                                                                                                  │
                     ┌────────────────────────────────────────────────────────────────────────────┤
                     ▼                         ▼                          ▼                      ▼
              Canvas2D (fabric.js)     Canvas3D (three.js)        render_ai (FLUX.2)     costs.js / budget_advisor
              edit, snap, AI Edit      walkthrough, immersive     empty → furnished       takeoff → cuts
```

The plan is stored as one JSON list of elements per project in the database. The 2D editor, the 3D model, the renders, the costs and the PDF all read from that list.

---

## Project structure

```
Arch-E-Tech/
├── backend/                     FastAPI service (Render)
│   ├── main.py                  App, auth, projects, photos and all /api routes
│   ├── database.py              Engine setup: Postgres (psycopg2) or local SQLite
│   ├── models.py                User, Project, RoomRender, SavedPhoto
│   ├── floorplan_builder.py     parse_prompt, build_program, deterministic layout
│   ├── plan_designer.py         Reference-guided LLM layout, validation, adapt_reference
│   ├── reference_plans.py       Library of reference house plans
│   ├── multi_floor.py           Floor splitting, stair placement, balconies, railings
│   ├── plan_editor.py           AI Edit: sentence → validated update/delete/add operations
│   ├── budget_advisor.py        Budget Advisor (Groq + rule fallback)
│   ├── render_ai.py             Cloudflare Workers AI prompts and image calls
│   └── requirements.txt
├── client/                      React + Vite app (Vercel)
│   ├── src/
│   │   ├── App.jsx              Routes
│   │   ├── index.css            Tailwind theme (charcoal / bone / terracotta palette)
│   │   ├── components/
│   │   │   ├── LandingPage.jsx, EngineLoop.jsx, Auth.jsx, Mark.jsx
│   │   │   ├── Dashboard.jsx, NewProject.jsx, PhotoGallery.jsx
│   │   │   ├── Studio.jsx         Studio shell: panels, toolbar, floors, dock
│   │   │   ├── Canvas2D.jsx       fabric.js plan editor
│   │   │   ├── Canvas3D.jsx       3D house, walkthrough, roof, lights
│   │   │   ├── StudioTools.jsx    Auto Detect, AI Layout, AI Edit, Rooms, Concept, Budget panels
│   │   │   ├── FeatureDock.jsx    Right-hand feature dock
│   │   │   ├── ImmersiveView.jsx  House on a plot in a neighbourhood
│   │   │   ├── RenderStudio.jsx   Photo Render
│   │   │   ├── Overview.jsx       Presentation slideshow
│   │   │   └── InfoTip.jsx        (i) explanations
│   │   └── utils/
│   │       ├── costs.js           Cost takeoff
│   │       ├── units.js           sq ft / m², ₹ / $ / € formatting
│   │       ├── detectRooms.js     Room detection from walls
│   │       ├── planSymbols.js, textureLibrary.js, wallTexture.js
│   └── vite.config.js
├── render.yaml                  Render blueprint for the backend
└── vercel.json                  SPA rewrites for the frontend
```

---

## Running it locally

**Requirements:** Python 3.11+, Node 20+.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Without `DATABASE_URL`, the backend uses `backend/archetech.db` (SQLite), which is created automatically. API docs are at http://localhost:8000/docs.

To turn on the AI features locally, put the keys in `backend/.env`, which is git-ignored:

```env
GROQ_API_KEY=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

### Frontend

```bash
cd client
npm install
npm run dev                        # http://localhost:5173
```

The client calls `http://localhost:8000` unless `VITE_API_URL` is set.

Other scripts: `npm run build` (production build into `client/dist`), `npm run preview`, `npm run lint` (oxlint).

### Without API keys
Everything still runs:
- Plans come from the reference library instead of the LLM.
- AI Edit says it needs `GROQ_API_KEY`; the drawing tools still work.
- The Budget Advisor uses its rules.
- Photo Render and Concept Viz report that image generation isn't configured.

---

## Environment variables

### Backend (Render)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes, in production** | Postgres connection string. For Supabase, use the **Session pooler** string (the direct host is IPv6-only). `sslmode=require` is added automatically. |
| `JWT_SECRET_KEY` | Yes in production | Signs login tokens. `render.yaml` generates one. |
| `GROQ_API_KEY` | Recommended | Plan generation, AI Edit, Budget Advisor, report text. |
| `CLOUDFLARE_ACCOUNT_ID` | For photos | Cloudflare account for Workers AI. |
| `CLOUDFLARE_API_TOKEN` | For photos | A token created from the "Workers AI" template. |
| `LAYOUT_MODEL` | Optional | Groq model, default `openai/gpt-oss-120b`. |
| `CF_IMAGE_MODEL` | Optional | Image model, default `@cf/black-forest-labs/flux-2-klein-4b`. |

On Render, the backend **refuses to start without `DATABASE_URL`**. Render's disk is wiped on every deploy, so falling back to SQLite there would silently delete every account and project.

Never commit keys. Set them in the Render dashboard (Environment) or in a local `.env`.

### Frontend (Vercel)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | URL of the Render backend, e.g. `https://arch-e-tech-backend.onrender.com` |

---

## Deployment

The `main` branch is the only branch. Pushing to it deploys both services.

### Backend on Render
- `render.yaml` defines the service: root `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Add the environment variables above in the dashboard.
- Health check: `GET /api/health`.
- The free tier sleeps when idle, so the first request after a while can take ~30 s.

### Frontend on Vercel
- Root directory: `client`. Framework: Vite. Build: `npm run build`. Output: `dist`.
- Set `VITE_API_URL` to the Render URL.
- `vercel.json` rewrites every path to `index.html` so React Router routes work on refresh.

### Database on Supabase
1. Project → Connect → **Session pooler** → copy the URI.
2. Put the database password in place of `[YOUR-PASSWORD]` and paste it as `DATABASE_URL` on Render.
3. Tables are created on startup. Data persists across deploys.

---

## API reference

All project, photo and AI endpoints except health take `Authorization: Bearer <token>` from login.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/projects` | List your projects |
| POST | `/api/projects` | Create a project |
| GET / PUT / DELETE | `/api/projects/{id}` | Read, save or delete a project |
| POST | `/api/projects/{id}/duplicate` | Copy a project |
| POST | `/api/ai/generate-plan` | Prompt → plan elements (single or multi-floor) |
| POST | `/api/ai/edit-plan` | Instruction + elements → edited elements |
| POST | `/api/ai/budget-advice` | Budget + takeoff + rooms → ranked cuts |
| POST | `/api/ai/report-narrative` | Written summary for the PDF report |
| POST | `/api/ai/compliance` | Basic code-compliance notes on a plan |
| POST | `/api/ai/chat` | Design assistant chat |
| GET | `/api/render/status` | Whether image generation is configured |
| GET | `/api/projects/{id}/renders` | A project's room photos |
| POST | `/api/projects/{id}/renders/empty` | Photograph a room empty |
| POST | `/api/projects/{id}/renders/upload` | Use your own photo of a room |
| POST | `/api/projects/{id}/renders/furnish` | Furnish an empty room photo |
| POST | `/api/projects/{id}/concept` | Concept image (cutaway or exterior) |
| GET / POST | `/api/photos` | List or save photos |
| GET / PUT / DELETE | `/api/photos/{id}` | Read, rename or delete a saved photo |
| GET | `/api/health` | Health and database check |

Interactive docs: `/docs` on the backend.

---

## Plan data format

A plan is a list of elements, and **20 units = 1 metre**. Every element is a rectangle drawn from `(left, top)` along `angle`, with `top` on its centre line:

```json
{ "type": "wall",   "left": 100, "top": 100, "width": 240, "height": 4, "angle": 0, "floor": 0 }
{ "type": "door",   "left": 160, "top": 100, "width": 18,  "angle": 0, "floor": 0 }
{ "type": "room",   "left": 100, "top": 160, "width": 240, "height": 120, "label": "Bedroom 2", "floor": 0 }
{ "type": "stairs", "left": 300, "top": 200, "width": 60,  "height": 24, "floor": 1, "arrival": true }
```

- Walls, doors and windows: `(left, top)` is the start of the centre line and `width` is the length.
- Rooms span `top - height/2` to `top + height/2`.
- `floor` is the storey (0 = ground). On the upper floor, stairs carry `arrival: true`.
- Furniture, railings and textures use the same rectangle convention.

---

## Units, currency and settings

- Areas show in **sq ft** by default (or m²), money in **₹** with Indian grouping (₹31,26,000 / ₹31.3 L) by default, or $ / €.
- Change both in Dashboard → Settings. They are stored in the browser (`pref_measurement`, `pref_currency`) and formatted by `client/src/utils/units.js`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Accounts or projects vanish after a deploy | `DATABASE_URL` isn't set on Render, or points at the wrong database. |
| `password authentication failed for user postgres` | Wrong database password in `DATABASE_URL`. Reset it in Supabase and update Render. |
| `Network is unreachable` connecting to Supabase | Use the Session pooler string, not the direct `db.<ref>.supabase.co` host. |
| Photo Render says it isn't configured | Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The free tier allows ~10,000 neurons a day. |
| AI Edit says it needs a key, or plans feel basic | `GROQ_API_KEY` is missing, so the reference and rule-based fallbacks are running. |
| First request is slow | Render's free tier was asleep. Wait ~30 s. |
| Walkthrough mouse look doesn't work | Click the 3D view to capture the mouse. Press Esc to release it. |
