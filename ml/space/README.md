---
title: Arch-E-Tech plan reader
emoji: 📐
colorFrom: gray
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

Reads a floor plan drawing (photo, scan or PDF) and returns an editable Arch-E-Tech plan. Called by the
Arch-E-Tech backend only (`POST /read` with a bearer token); `GET /health` checks it is up.

Trained on ResPlan (CC BY 4.0) and Arch-E-Tech's own generated plans.
