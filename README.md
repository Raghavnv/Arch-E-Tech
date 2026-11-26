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
- balcony, patio, terrace, study and other rooms

**Outdoor spaces:** tick Patio, Balcony or Terrace on the form (or say so in the prompt). A patio is built off the living or dining room on the ground floor, away from the front door. Balconies go off the master bedroom (or another bedroom) on each upper floor, with railings and a wide door. The terrace takes the open roof of the floor below where there is one, or is built off the family lounge. A balcony or terrace on a one-storey house offers to make it two floors. Sizes and sides change every time, so houses still come out different.

The planner picks similar reference houses, asks the LLM to design a new layout, then cleans and validates it. Bedrooms are spread around the house rather than lined up. If the LLM's answer is unusable, a reference plan is adapted instead, so a plan is always produced.

Room sizes are generous: bedrooms 12.5–24 m² (about 16 m² on average), the master 17 m² and up, bathrooms 4.2–10 m² with the master's own bathroom the biggest. The master is a **suite**: bedroom → walk-in closet (1.5–2 m wide, with wardrobes) → ensuite bathroom, and the bathroom is entered only through the closet. On a very tight plot the closet is left out rather than squeezing the bedroom.

### Plot, facing and Vastu
- New Project takes an optional plot (frontage × depth, in ft or m), which side the road is on, and a Vastu toggle.
  The prompt works too: "3 bhk on a 30x40 plot, east facing, vastu".
- The house is fitted inside the plot after typical Indian setbacks (smaller plots: front ≥ 1 m, rear 0.75 m,
  0.5 m a side; larger: front ≥ 1.5 m, rear 1.5 m, 1 m a side), with the front door on the road side. Tight plots get
  compact layouts (living at the front, kitchen and dining in the middle, bedrooms behind, along a passage when needed).
- If the rooms don't fit on one floor, the house goes up to two or three floors and says so. If nothing fits, the plan
  ignores the plot and says why.
- With Vastu on, layouts that follow it are preferred (kitchen south-east, master bedroom south-west, no toilet in the
  north-east, open centre, north / east entrance, ...). **Studio → Vastu check** scores any plan and explains each rule;
  set which way north points on the drawing.

### Drawings to build from
Studio → REPORTS:
- **Plan sheet (PDF):** A3, one page per floor, drawn as vectors at a standard scale (1:50 to 1:500): solid walls,
  door swings, windows, room names with sizes and areas, wall-by-wall and overall dimensions, north arrow, scale
  bar, title block and room schedule.
- **CAD drawing (DXF):** the floor as an AutoCAD R12 drawing in metres, on layers A-WALL, A-DOOR, A-GLAZ, A-AREA,
  A-STRS, A-FURN and A-ANNO-*, so it opens in AutoCAD, LibreCAD, DraftSight and most CAD apps.

### Building rules
Studio → **Building rules** checks every room against the National Building Code of India 2016 minimums (habitable
room 9.5 m² and 2.4 m wide, kitchen 5.0 m² / 1.8 m, bathroom 1.8 m² / 1.2 m, separate WC 1.1 m² / 0.9 m), that
habitable rooms and kitchens have windows (and, as many bye-laws ask, at least a tenth of the floor area), and the
plot against the **city's** typical bye-laws for a small house plot: Bengaluru, Chennai, Hyderabad, Mumbai, Pune,
Ahmedabad, Kolkata, Delhi, Jaipur, Kochi, Chandigarh, Guwahati, or the National Building Code. For each it checks
ground coverage, FAR / FSI, height, setbacks (by plot size, against the house's real width and depth) and parking
(a 5 m deep front yard, a garage or a stilt floor). It answers with a verdict ("likely to meet the rules" / "needs
changes") and specific fixes ("make the house 1.7 m narrower along the road", "remove about 12 m² from the top floor").
Balconies, terraces and patios are left out of the built-up area. Any limit can be overridden. Bye-laws change with the
zone and road width, so this is guidance to confirm with the local authority, not an approval.

### Home loan & EMI
Studio → **Home loan & EMI**: the monthly EMI, total interest and repayments for the house (the live estimate, plus the
plot if it's being financed), what a bank would lend on your take-home pay (EMIs kept under half of it), RBI's
loan-to-value limit (90 / 80 / 75% by loan size) and the down payment it needs. The loan is paid out stage by stage with
the build schedule (your money first, then the bank's), with the interest-only "pre-EMI" during construction. A chart
shows principal and interest each year, plus a note on the old-regime tax deductions (24b, 80C). An estimate to plan
with, not a loan offer.

### Electrical and plumbing
Studio → **Electrical & plumbing** lays out a first set of points from the plan: lights, fans, switchboards by the
doors, 6 A sockets along free walls, 16 A points for the kitchen and utility, AC points by windows, geyser and
exhaust points, the distribution board inside the front door; water supply points, floor traps and soil stacks on
outside walls. It shows them over the plan with counts and a rough wiring / piping cost, and downloads the plan
sheet with a services page per floor. A starting point for the electrician and plumber, not a design.

### Sharing with clients
Studio → **Share with client** makes a view-only link (`/shared/<token>`). Anyone with it can see the plan without an
account, comment on the plan or on a room, and approve it or ask for changes. An approval records the exact version
of the plan; the owner sees comments (and can mark them done), approvals, and whether the plan has changed since.
Links can be turned off at any time.

The share page reads in **English, Hindi, Kannada or Tamil**: the reader switches at the top, and the owner can send a
link that opens in a language (Share with client → Opens in). Room names left as the defaults ("Bedroom 2", "Kitchen")
are translated on the plan and in the lists; names the owner typed are shown as written.

### Compare options
Studio → **Compare options** puts versions of the house side by side: the plan on screen and up to six options saved
with the project. Each shows its plan (floor by floor) with built-up area, bedrooms and baths, outdoor space, estimated
cost, monthly EMI (with the owner's Home loan settings), build time, daylight & comfort and Vastu scores, and how its
rooms differ from the first; the best value in each row is marked. **Generate another option** draws a different layout
with the same brief (bedrooms, baths, floors, extra rooms, outdoor spaces, plot and facing); **Save plan as option**
keeps the plan on screen so it can be changed and compared. **Use this option** makes an option the plan, keeping the
plan on screen as an option first. On the share link clients see the options and vote for one, with a note; voting
again moves their vote. Owners see the tally and the notes; votes survive new finishes but not a changed layout.


### Multi-floor houses
- Rooms are split across floors, with stairs placed to line up on both levels.
- Balconies and patios get railings automatically.
- In 3D the floors are stacked into one house, with stair openings cut through the slabs, and you can switch between floors or show them all.

### The Studio (2D editor)
- Draw walls, doors, windows, stairs and railings. Place furniture from the library.
- **Smart Snap:** walls snap to each other's ends, to right angles and to the grid.
- **Auto Detect:** finds the rooms enclosed by your walls and labels them.
- **AI Layout:** generate or regenerate the layout from a prompt while you are in the Studio.
- **AI Edit:** type any change in plain words, several at once: "make the master bedroom 1 m wider and add a balcony to it", "add a patio off the living room", "put a door between the kitchen and the dining room", "split the study into a study and a bathroom", "merge the dining and living rooms", "turn the closet into a pooja room", "add two plants to the lounge", "paint the living room sage with a teak feature wall", "herringbone floors in all bedrooms", "cove ceiling with a chandelier in the dining room", "make the whole house Japandi", "paint the exterior navy". The AI only chooses *what* to do. The Studio does the geometry: moving a room's wall moves the wall itself, keeps corners joined, shrinks the neighbouring room and carries doors, windows and furniture along. New rooms get walls, a door and windows, outdoor spaces get railings, and openings go in free stretches of real walls. It works on every floor. Without `GROQ_API_KEY` a built-in parser understands the same kinds of requests.
- **Rooms:** rename rooms and see each room's area.
- **Material Painter:** apply textures to walls and floors; click another texture to switch directly.
- Undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), autosave to the server with a sync indicator.
- Both side panels can be hidden for a full-screen view. The Studio remembers your choice.
- **(i) tips** next to each feature explain what it does.

### Feature dock
The Studio's right sidebar, styled like the left Tools panel: a search box, then every feature as an icon grid under three headings (View & present, Design, Reports & export), all visible at once. The plan canvas sits between the two sidebars and resizes when either is hidden; hidden, the right sidebar becomes a slim rail of icons:

| Group   | Feature        | What it does |
|---------|----------------|--------------|
| View    | Walkthrough    | First-person walk through the rooms at eye level (WASD + mouse) |
| View    | Immersive View | The house on a landscaped plot in a neighbourhood, with time of day, weather and roof options; walk in from the street |
| View    | View in AR     | The house through a phone camera: a 1:40 model on a table, or life size to walk into |
| View    | Video tour     | A ~50-second film of the house (street, entrance, every room, photos) as MP4 to send |
| View    | Room Designer  | Furnish a room yourself from a catalogue of 60+ pieces, in plan and 3D |
| View    | Overview       | A presentation: floor plans, 3D model, every room, photos and the cost takeoff |
| AI      | Photo Render   | A photo of every room, empty and then furnished, all in the same house style |
| AI      | Concept Viz    | A 3D cutaway or exterior concept image of the whole house |
| AI      | Budget Advisor | Enter your budget; get ranked suggestions on where to cut back |
| Reports | Cost takeoff   | The live estimate, item by item |
| Reports | Materials & schedule | Cement, steel, sand, bricks, tiles, paint… with costs, and a month-by-month build timeline |
| Reports | PDF Report     | Plan, costs and notes as a PDF |

### Walls, floors, ceilings and lights
In the 3D view the finishes panel has three tabs:
- **Walls**: 30 paint colours in five families plus any colour; wood panelling (oak, walnut, teak, whitewashed pine, reclaimed, smoked oak); 7 wallpapers (botanical, geometric, pinstripe, damask, art deco, palm, grasscloth); stone cladding (stacked stone, whitewashed brick, marble slab); stone, tile and plaster. A click paints the side of the wall you clicked; "Walls of one room" paints only the side facing that room and only along it, so an accent wall stops at the corner; "Every wall" does both sides.
- **Floors**: 22 finishes per room: oak, walnut, grey-washed oak, teak, herringbone, chevron and wood-look tile; white, black and beige marble, granite, Kota stone, terrazzo, polished concrete; vitrified tiles, Moroccan, hexagon, black and white check, terracotta, anti-skid mosaic and Athangudi.
- **Ceilings**: plain, false ceiling with cove light, tray, coffered, wooden slats, round POP, exposed beams, peripheral band with spots, backlit panel, wooden wave and wooden coffers; lights: flush, chandelier, crystal chandelier, pendants, globe cluster, linear pendant, recessed spots, track lights, fan with light, LED ring, lantern; and a ceiling colour. Live preview in the panel.

Floors, ceilings and lights are priced in the cost takeoff, and all of it shows in the walkthrough, Photo Render captures and the video tour.

### Design my house
One click to style the whole house (Studio → feature dock → Design my house): Modern minimal, Japandi, Modern Indian, Luxury classic, Scandinavian, Industrial loft or Tropical boho. Each room gets its wall colour on its own side of each wall, a feature wall in the main rooms (wood, wallpaper, brick or a deep colour), floors, a ceiling design and light, an exterior colour, and decor placed where it fits (a rug, plants, a floor lamp, wall art). Choose which of these to change; applying another style replaces the last one's finishes and decor, and undo takes it back.

### Match a photo
Studio → **Match a photo**: drop in a photo of a room you love (Pinterest, a magazine, a friend's house) and the app picks
the closest wall paint, floor, accent wall (a paint, or a wood finish when the accent is wood) and whole-house style from
its own library, showing the colour each came from and the next-closest alternatives. Apply to the whole house (paint in
the living rooms, bedrooms and halls; floors there too; an accent wall in the living room, lounge and master bedroom,
kitchen and bathrooms keep theirs) or to one room; undo takes it back. The photo is read in the browser (its colours
grouped in Lab colour space) and never uploaded.

### Scan a material
Studio → **Scan a material**: photograph a real sample (a plank, a marble offcut, granite, a stone from the site, a
brick, a tile) with the camera, or upload a photo, and lay it on the house. The middle of the photo becomes a seamless
tile (its uneven light flattened, its edges blended into each other), shown repeating 3 × 3 before it is used. The app
says what the material is. With a `GROQ_API_KEY` a vision model on the server names it ("Statuario marble"). Otherwise
an image model runs in the browser (CLIP ViT-B/32, about 89 MB from Hugging Face on the first scan, then cached by the
browser; the photo never leaves the device) and compares the photo with 8 typical examples of each material, condensed
from 493 labelled Wikimedia Commons photos (`client/src/utils/materialExamples.json`). On photos it had not seen it
named the material right first time for 71 % and in its top three for 87 %; clean close-ups do better. If the model
can't load (offline), a colour-and-texture guess (`materialReference.json`) stands in and says so. The next likeliest
kinds are always one tap away.
Set how much the photo covers (the pattern's size), then lay it on chosen floors, as an accent wall or on every wall of a room,
or just save it. Scans are kept with the project (up to 30) and appear under **Your materials** in Walls & floors; they
show in 2D, 3D, the walkthrough, Photo Render, AR, Immersive View, the Overview and the cost takeoff (priced by kind).
On a phone, Take a photo opens the camera app.

### Shopping list
Studio → **Shopping list**: every piece of furniture and decor in the plan, room by room (both floors), with quantities,
sizes and an estimated price, and links that search real shops for each piece: Pepperfry, Urban Ladder, IKEA and Amazon
in India; IKEA, Wayfair and Amazon in dollars or euros. Tick pieces off as bought (remembered on that device) to see what
is left to spend, include or leave out the fitted kitchen and bathroom, and download it as a spreadsheet (CSV). Prices
are estimates for a mid-range piece of the size drawn, not quotes.

### Kitchen & wardrobes
Modular kitchens laid out along a kitchen's walls, clear of its doors: straight, L, parallel, U or L with an island; sink under a window, hob with a chimney, fridge and oven tower, wall cabinets above; 8 cabinet colours, 5 countertops, and a backsplash band. Wardrobes for bedrooms: hinged, sliding or mirrored, 6 finishes, the whole wall or a set width, on the best wall or one you pick. A plan preview shows the result first.

### Windows
Frames (black or grey aluminium, white UPVC, teak, bronze) and curtains, sheer curtains, venetian, roman or roller blinds in ten fabrics, hung on the room side of each window; priced in the takeoff. Design my house dresses every window.

### Front elevation
Exterior paint, a cladding or colour round the entrance or across the whole front, pitched roof tile colour or a flat roof with a parapet colour, balcony railings (glass, metal, wood), gate style and colour, compound wall finish, height and colour, and outdoor lights (door sconces, path bollards, uplights), previewed live on the house's street at any time of day. Saved with the project and shown in 3D, the Immersive View, photos, the video tour and AR.

### Your own styles
Save a designed house's look (each room type's paint, feature wall, floor, ceiling and light, window frames and curtains, exterior colour, decor) as a style on your account, and apply it to your other houses from Design my house.

### Finish schedule (PDF)
Room by room: wall finishes with areas and named paint shades, backsplash, floor, ceiling and light, windows, furniture, each priced with a room total; then paint by shade in litres and the house's totals. For the painter, the flooring and false-ceiling contractors, and the budget.

### Construction tracker
The build schedule from the estimate as a live project: start date, each phase not started / under way / done, money actually spent (flagged when over the estimate), notes and site photos. It shows % built against the plan for today, spend against the estimate, and the finish date at the current pace. Clients see the progress and the latest photos on their share link.

### Daylight & comfort
Every living room, bedroom, kitchen and study is scored out of 100 for daylight (window area against floor area), how deep light reaches, hours of direct sun in June and December for each window's real compass direction at the chosen city, heat from afternoon (west) sun, and cross-ventilation, with plain suggestions (a wider window, a sunshade on the west window, a second window for through-air). The house's score is weighted by floor area.

### 3D extras
Room names float over the model (toggle), the walkthrough has a mini-map showing where you are and the room you are in, and every 3D view keeps working when the reflection lighting can't be downloaded (offline).

### 3D view
- Walls with real window and door openings, glass, textured materials, furniture, ceilings and lights.
- Flat or pitched roof, or no roof to look inside. Roofs follow the house's own outline: a flat roof's parapet runs along the outer walls, and an L- or T-shaped house gets hipped roofs over each wing meeting in valleys, with short eaves, never one big roof over the whole bounding box.
- Camera distance adapts to the size of the house.

### Immersive View and the street walk
- The house on its plot in a street: lawn, compound wall and gate, a path to the front door, neighbours, time of day and weather. The front door is found from the plan (a door with a room on one side and open ground on the other), and the path, steps and porch light line up with it.
- **Walk around**: start on the footpath, go through the gate, up the steps onto the plinth and in through the front door. Walls, the compound wall and the neighbours' houses stop you. Mouse-look with pointer lock, or drag to look on a trackpad or touch screen.

### View in AR
- **Model** (1:40) to set on a table or on the plot, or **Life size** to stand in the rooms. Roof on, or open to look inside.
- Android (Chrome): runs in the browser with WebXR. Point at the floor, tap to place, then turn, resize or move it.
- iPhone and iPad: a USDZ model of the house is made on the phone and opens in Apple's AR viewer.
- On a computer: a 3D preview and a QR code to open the same view on a phone.

### Video tour
A short film made in the browser: it flies in over the street with the house's name and size, drifts across the front, walks up to the door, visits each main room at eye level with its name and area, shows the photo renders, and pulls back to finish. Recorded as MP4 (WebM where the browser can't do MP4), ready to download or share.

### Materials & schedule
Worked out from the drawing for an ordinary RCC-frame house with brick walls (230 mm outside, 115 mm inside):
- Materials with quantities and cost: cement bags, steel, sand, aggregate, bricks, tiles, paint, primer, putty, waterproofing, doors, windows, wiring and pipes; plus labour and the cost per m² / sq ft. Enter your own local prices under **My prices**.
- Quantities of work: excavation, PCC, RCC (footings, columns, beams, slabs), brickwork, plaster, flooring, painting.
- A build schedule, phase by phase and floor by floor (foundation, frame and slab curing, walls, services, plaster, flooring, finishes, painting), with each phase's cost.
- Download everything as CSV. It's an estimate for planning and budgeting; footings and steel must come from a structural engineer.

### Photo Render
1. Each room's base picture is **taken inside your 3D house**, framed to show as much of the room as possible: corner views, straight-on views from the middle of each wall, and for small rooms a cutaway from behind one wall (left out of the picture) are each scored on how much floor, furniture and window they get in frame, and the best one is used. So the picture is the actual room, with its real size, walls, windows and doors. "Capture all rooms" does every room at once. This needs no AI.
2. The AI then furnishes that picture: it turns the plain 3D view into a photo, keeping the camera, walls, windows and doors where they are, and adds furniture the way your prompt and the house style describe.
3. Or capture the room **with the furniture you placed** (in the Studio or the Room Designer), and the AI makes that exact arrangement photorealistic.
4. You can still have the AI imagine an empty room, or upload your own photo. Keep any photo in Saved Photos.

### Room Designer
Furnish one room yourself, without AI (Studio → feature dock → Room Designer, or "Design it myself" in Photo Render).
- A catalogue of 60+ pieces for living, dining, bedroom, kids, study, kitchen, bathroom, utility and pooja, balcony and outdoor, and decor and lighting, each with real sizes and a price. Pieces suited to the room are shown first.
- New pieces go to a free spot against a wall. Drag them anywhere (they snap to walls), turn, resize, recolour, duplicate and delete them, with undo and redo.
- Warns about pieces that overlap, stick out of the room, or block a door swing, and shows the furniture cost and how much floor is covered.
- A 3D view of the room. Saving writes the furniture into the plan, where the Studio, the 3D house, the drawings and the costs all see it; "Make it a photo" goes on to Photo Render.

### Import a floor plan
Dashboard → **Import plan** (new project) or Studio feature dock → **Import plan** (replaces the current floor, undoable).
1. Upload a photo, scan or PDF (first page) of a floor plan, up to 15 MB.
2. The plan reader (`ml/`, a U-Net trained on ResPlan and generated plans, plus OCR) finds walls, doors, windows and rooms,
   reads room names ("M. BEDROOM", "TOI.", "SIT OUT") and room sizes ("12'0\" x 10'6\"").
3. Review the traced plan over the faded drawing. The scale comes from the written room sizes when there are any,
   otherwise from wall thickness; **Measure a known length** sets it exactly.
4. Accept, then edit as usual.

Sharing is opt-in: only when the owner ticks the box are the drawing and the accepted plan kept, to retrain the reader
(`backend/export_plan_imports.py`, then `ml/archetech_ml/user_data.py`). See [`ml/README.md`](ml/README.md).

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
│   ├── plan_editor.py           AI Edit: request → actions (AI or parser), carried out, summary
│   ├── plan_actions.py          The edits themselves: move walls, add rooms / outdoor spaces, doors, windows, furniture
│   ├── edit_intents.py          Plain-English request parser (works without an AI key)
│   ├── budget_advisor.py        Budget Advisor (Groq + rule fallback)
│   ├── render_ai.py             Cloudflare Workers AI prompts and image calls
│   ├── layout_generator.py      Procedural layouts: a different house for almost every brief; fits plots
│   ├── vastu.py                 Vastu checks and score for any plan
│   ├── building_rules.py        NBC 2016 room sizes, windows, plot coverage / FAR / setbacks
│   ├── services_layout.py       Electrical and plumbing points from the plan
│   ├── quantities.py            Material quantities, costs and build schedule
│   ├── export_cad.py            DXF (AutoCAD R12) export
│   ├── sharing.py               Share links, client comments and approvals
│   ├── options.py               Plan options kept side by side, and client votes
│   ├── extras.py                Saved styles, front elevation, build progress, scanned materials, material identification
│   ├── plan_import.py           Plan import routes (forwards drawings to the plan reader service)
│   ├── export_plan_imports.py   Exports shared (consented) imports for retraining the reader
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
│   │   │   ├── RoomCapture.jsx    Takes a room's picture inside the 3D house
│   │   │   ├── RoomDesigner.jsx   Furnish a room yourself
│   │   │   ├── VideoTour.jsx      Records a film of the house
│   │   │   ├── Ceilings.jsx       Ceiling designs and light fittings
│   │   │   ├── FinishesPanel.jsx  Walls, floors, ceilings & lights
│   │   │   ├── DesignStyleModal.jsx Design my house: whole-house styles
│   │   │   ├── ARView.jsx         The house in AR (WebXR, Quick Look)
│   │   │   ├── Overview.jsx       Presentation slideshow
│   │   │   ├── ImportPlanModal.jsx Upload a drawing, review the traced plan, set the scale
│   │   │   ├── SharedProject.jsx  The page behind a share link: view, comment, approve, vote
│   │   │   ├── CompareOptions.jsx Compare options side by side
│   │   │   ├── PhotoMatch.jsx     Match a photo: finishes from an inspiration photo
│   │   │   ├── MaterialScan.jsx   Scan a material: camera or upload, identify, tile, lay on the house
│   │   │   ├── ShoppingList.jsx   Furniture to buy, room by room, with shop links
│   │   │   └── InfoTip.jsx        (i) explanations
│   │   └── utils/
│   │       ├── costs.js           Cost takeoff
│   │       ├── units.js           sq ft / m², ₹ / $ / € formatting
│   │       ├── detectRooms.js     Room detection from walls
│   │       ├── furnitureCatalog.js 60+ furniture pieces: sizes, prices, 3D parts
│   │       ├── roomCamera.js      Where to stand to photograph a room
│   │       ├── roofShape.js       The house outline for roofs and the plinth
│   │       ├── floorFinishes.js   22 floor finishes, drawn procedurally
│   │       ├── designStyles.js    Whole-house interior styles
│   │       ├── photoPalette.js    A photo's colours matched to paints, floors, wood and styles
│   │       ├── loan.js            EMI and loan limits
│   │       ├── materialScan.js    Material recognition, seamless tiles, the scanned-materials library
│   │       ├── materialAI.js      In-browser material recognition (CLIP) against labelled examples
│   │       ├── materialExamples.json  8 example embeddings per material, from 493 labelled photos
│   │       ├── materialReference.json 483 labelled material photos, measured, for the offline guess
│   │       ├── shareI18n.js       The share page in English, Hindi, Kannada and Tamil
│   │       ├── planSymbols.js, textureLibrary.js, wallTexture.js
│   └── vite.config.js
├── ml/                          Plan reader: training data, model training, OCR, plan_reader service (see ml/README.md)
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
- AI Edit uses its built-in parser, which understands most everyday requests (sizes, rooms, doors, windows, furniture, finishes).
- The Budget Advisor uses its rules.
- Photo Render still captures every room from the 3D house, and the Room Designer works fully; furnishing with AI and Concept Viz report that image generation isn't configured.

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
| `PLAN_READER_URL` | For plan import | URL of the plan reader service (`ml/serve.py`), e.g. `https://…hf.space`. Without it, Import plan says it isn't set up. |
| `PLAN_READER_TOKEN` | With the reader | Shared secret; set the same value on the reader service. |

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
| POST | `/api/ai/generate-plan` | Prompt (+ optional `plot_width_m`, `plot_depth_m`, `facing`, `vastu`) → plan elements, plus `site`, `vastu` and `notes` when a plot is given |
| POST | `/api/ai/edit-plan` | Instruction + elements → edited elements |
| POST | `/api/ai/vastu-check` | Elements + which way north points → Vastu score and checklist |
| POST | `/api/ai/building-check` | Elements + plot + limits → room-size, window and plot checks |
| POST | `/api/ai/services-layout` | Elements → electrical and plumbing points with counts |
| GET/POST/DELETE | `/api/styles` | Saved interior styles |
| PUT | `/api/projects/{id}/facade` | The front elevation |
| GET/PUT | `/api/projects/{id}/progress` | Construction progress and site photos |
| POST | `/api/ai/quantities` | Elements (+ optional prices) → materials, quantities of work, cost and build schedule |
| POST | `/api/export/dxf` | Elements + floor → DXF drawing (download) |
| POST / GET | `/api/projects/{id}/shares` | Make a share link / list links, comments and approvals |
| DELETE | `/api/projects/{id}/shares/{share_id}` | Turn a share link off |
| POST | `/api/projects/{id}/comments/{comment_id}` | Mark a client comment done or open |
| GET | `/api/shared/{token}` | The shared plan, comments and approvals (no login) |
| POST | `/api/shared/{token}/comments` | Comment through a share link (no login) |
| POST | `/api/shared/{token}/decision` | Approve or ask for changes through a share link (no login) |
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
| GET | `/api/plan-imports/status` | Whether plan import is configured |
| POST | `/api/plan-imports` | Upload a plan drawing (multipart `file`, `consent`) → traced plan elements |
| POST | `/api/plan-imports/{id}/accept` | Record the accepted plan for an import |
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
