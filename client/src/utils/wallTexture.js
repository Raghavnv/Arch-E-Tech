import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ARCHITECTURAL_TEXTURES } from './textureLibrary';

/*
 * Wall textures for the 3D views.
 *
 * The library textures are SVG data URLs. Handing an SVG <img> straight to WebGL works in Chrome,
 * but Safari and some GPU drivers upload it as solid black. So every texture is first drawn onto a
 * plain 2D canvas (power-of-two sized, so it can repeat and mipmap) and the canvas becomes the
 * texture. While that happens, or if it fails, the wall shows the texture's own base colour.
 */

const TILE_M = 1.6;            // one texture tile covers 1.6 m of wall horizontally
const rasters = new Map();     // url -> Promise<HTMLCanvasElement | null>, shared by every wall

const pow2 = n => 2 ** Math.round(Math.log2(Math.max(64, Math.min(1024, n))));

function rasterize(url) {
  if (!rasters.has(url)) {
    rasters.set(url, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || 256, h = img.naturalHeight || 256;
        const k = 256 / Math.min(w, h);
        const canvas = document.createElement('canvas');
        canvas.width = pow2(w * k);
        canvas.height = pow2(h * k);
        try {
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.getContext('2d').getImageData(0, 0, 1, 1);   // throws if the image tainted the canvas
          resolve(canvas);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return rasters.get(url);
}

/** The base colour of a library texture, used before / instead of the image. */
export function textureColor(url) {
  return ARCHITECTURAL_TEXTURES.find(t => t.url === url)?.color || null;
}

const isImage = m => typeof m === 'string' && (m.startsWith('data:image') || m.startsWith('http'));

/**
 * Material props for a wall of `length` x `height` metres painted with `material`
 * (an image URL, or a colour when `isColor`). Never returns a black surface.
 */
export function useWallMaterial(material, isColor, length, height) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (isColor || !isImage(material)) { setTexture(null); return; }
    let alive = true;
    let tex = null;
    rasterize(material).then(canvas => {
      if (!alive || !canvas) { if (alive) setTexture(null); return; }
      tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const tileH = TILE_M * (canvas.height / canvas.width);
      tex.repeat.set(Math.max(length / TILE_M, 0.25), Math.max(height / tileH, 0.25));
      tex.needsUpdate = true;
      setTexture(tex);
    });
    return () => { alive = false; tex?.dispose(); };
  }, [material, isColor, length, height]);

  // `key` gives each kind of surface a fresh material: one compiled without a map never picks one up
  if (texture) return { key: `map-${texture.uuid}`, map: texture, color: '#ffffff', roughness: 0.8 };
  if (isColor && material) return { key: `color-${material}`, color: material, roughness: 0.9 };
  const base = isImage(material) && textureColor(material);
  if (base) return { key: `base-${base}`, color: base, roughness: 0.85 };
  return { key: 'plain', color: '#f4f4f5', roughness: 0.85 };
}
