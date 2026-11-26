/*
 * Material recognition with an image model that runs in the browser (CLIP). The model turns a photo into
 * a list of numbers that places similar-looking things close together. materialExamples.json holds the
 * same numbers for labelled photos of real materials: 8 typical ones per kind, condensed from 493 Wikimedia
 * Commons photos and stored as 8-bit numbers in base64. A scan is named after the kind it sits closest to.
 * Tested on photos it had not seen, it named the material right first time for 71 % and in its top three
 * for 87 % (many of those photos were whole buildings; close-ups do better).
 * The model (MODEL_MB) is fetched from Hugging Face on the first scan and then cached by the browser;
 * photos never leave the device.
 */
import EXAMPLES from './materialExamples.json';

export const MODEL_ID = EXAMPLES.model;
export const MODEL_MB = EXAMPLES.mb;

const loaders = new Map();
/** The image half of a CLIP model, loaded once. `onProgress(0..1)` reports the download. */
export function loadModel(onProgress, modelId = MODEL_ID) {
  if (!loaders.has(modelId)) {
    loaders.set(modelId, (async () => {
      const T = await import('@huggingface/transformers');
      T.env.allowLocalModels = false;
      const files = new Map();
      const progress = (p) => {
        if (p.status === 'progress' && p.total) {
          files.set(p.file, [p.loaded, p.total]);
          const [got, all] = [...files.values()].reduce((a, [l, t]) => [a[0] + l, a[1] + t], [0, 0]);
          onProgress?.(all ? got / all : 0);
        }
      };
      const [processor, model] = await Promise.all([
        T.AutoProcessor.from_pretrained(modelId, { progress_callback: progress }),
        T.CLIPVisionModelWithProjection.from_pretrained(modelId, { dtype: 'q8', progress_callback: progress }),
      ]);
      return { T, processor, model };
    })().catch((e) => { loaders.delete(modelId); throw e; }));
  }
  return loaders.get(modelId);
}

const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
const decode = (b64) => unit(Array.from(new Int8Array(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer)));
let KINDS = null;
const kinds = () => KINDS || (KINDS = Object.fromEntries(Object.entries(EXAMPLES.kinds).map(([k, list]) => [k, list.map(decode)])));

/** A photo's embedding: from a data URL or an image URL. */
export async function embedImage(src, onProgress, modelId = MODEL_ID) {
  const { T, processor, model } = await loadModel(onProgress, modelId);
  const raw = await T.RawImage.read(src);
  const { image_embeds } = await model(await processor(raw));
  return unit(Array.from(image_embeds.data));
}

/** How close a photo's embedding is to each kind: [{ kind, score }] best first, scores adding up to 1. */
export function rankEmbedding(v) {
  const best = Object.entries(kinds()).map(([kind, list]) =>
    [kind, Math.max(...list.map(e => e.reduce((s, x, i) => s + x * v[i], 0)))]);
  const exp = best.map(([kind, s]) => [kind, Math.exp(EXAMPLES.scale * s)]);
  const sum = exp.reduce((s, [, x]) => s + x, 0) || 1;
  return exp.map(([kind, x]) => ({ kind, score: Math.round((x / sum) * 100) / 100 })).sort((a, b) => b.score - a.score);
}

/** What material a photo shows (a data URL): [{ kind, score }] best first. */
export async function recognise(src, onProgress) {
  return rankEmbedding(await embedImage(src, onProgress));
}
