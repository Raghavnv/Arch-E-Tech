# Putting the plan reader online (Hugging Face Spaces, free)

The live site needs the plan reader running somewhere it can reach. A free Hugging Face Space has enough
memory (16 GB) for the model; Render's free tier does not.

## 1. Build the folder to upload

```bash
sh ml/make_space.sh
```

This makes `ml/space_build/` (about 93 MB): the Space's Dockerfile and README, the reader code, and the
trained model (`model/best.pt`, which is kept out of git).

## 2. Create the Space

1. Sign in at huggingface.co, then **New → Space**.
2. Name it, for example `archetech-plan-reader`. **Space SDK: Docker**, template **Blank**, hardware
   **CPU basic (free)**. Leave it **Public**: the reader refuses any request without your secret token,
   and a private Space would need a second token in the same header.
3. **Files → Add file → Upload files**: drag in everything inside `ml/space_build/`, keeping the
   `archetech_ml/` and `model/` folders. Commit.
4. **Settings → Variables and secrets → New secret**: `PLAN_READER_TOKEN`, a long random value. Keep it
   for step 3.
5. The Space builds (about 5 to 10 minutes). When it shows **Running**, open
   `https://<your-username>-archetech-plan-reader.hf.space/health`: it should say `{"status":"ok", ...}`.

## 3. Point the backend at it (Render)

In the Render dashboard, open the backend service → **Environment**:

- `PLAN_READER_URL` = `https://<your-username>-archetech-plan-reader.hf.space`
- `PLAN_READER_TOKEN` = the same value as the Space's secret

Save; Render redeploys. Import plan then works on the live site.

## Notes

- A free Space sleeps after about two days unused. The first import after that waits while it wakes
  (up to a minute or so); the backend keeps retrying for 90 seconds.
- To update the model later, run `sh ml/make_space.sh path/to/new/best.pt` and upload `model/best.pt` again.
- Credit "ResPlan" (CC BY 4.0) wherever the model is shipped; the Space README does.
