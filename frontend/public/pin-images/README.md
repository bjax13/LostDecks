# Pin photos

Pin photos are static files in this folder. A production build copies this folder to `frontend/dist/pin-images/`, and Firebase Hosting serves a file at:

`/pin-images/{PIN-ID}-{size}.webp?v={version}`

`PinImage` (`frontend/src/components/PinImage/pinImage.js`) builds that URL. Sizes are only `96`, `320`, and `800`. The version is a positive integer from the generated catalog. Files stay flat in this directory. There is no per-version folder. A reshoot keeps the same file names and changes `?v=`.

The pin id is the catalog id, for example `PIN-CF-01`. It must match `PIN-` + a set code of 2 to 6 letters or digits + `-` + 2 or 3 digits (the same pattern as pin SKUs). Any other id produces no URL, so the slot stays on the no-photo tint and makes no request.

## Where each size is used

Ship all three files before turning a photo on. A positive version makes the app request files. If the chosen file fails to load, that slot drops back to the tint after the failed request.

| File | Requested by |
| --- | --- |
| `{PIN-ID}-96.webp` | Small slots: `src`, and the `1x` candidate |
| `{PIN-ID}-320.webp` | Small slots: the `2x` candidate. Detail page: `src`, and the `1x` candidate |
| `{PIN-ID}-800.webp` | Detail page: the `2x` candidate. Lightbox: the only `src` |

Small slots use `srcset` of `96 1x, 320 2x`, `loading="lazy"`, and `decoding="async"`. Those variants are:

- Collectibles grid (`variant="grid"`, drawn at 64px)
- Collectibles table and collection rows (`variant="row"`, drawn at 40px)
- Match piles (`variant="match"`, drawn at 32px)

The detail page (`variant="detail"` in `frontend/src/pages/CollectibleDetail`) uses `srcset` of `320 1x, 800 2x`, `fetchpriority="high"`, `decoding="async"`, and no lazy loading. The slot is 320px wide on a wide screen and full width below 640px, always square. Clicking it opens a lightbox whose image is `{PIN-ID}-800.webp?v={version}` (800 by 800, `decoding="async"`, no `srcset`).

The slot photo uses `object-fit: cover`. A file that is already square is shown whole. A file that is not square is cropped by the slot. The lightbox uses `object-fit: contain`.

Story cards have no pin photo slot. The getting-started picker does not render `PinImage`.

## Make the three files

Each file must be:

- Square. Fit the photo inside the square and center-pad the leftover space. Do not crop.
- WebP, quality around 75.
- Free of EXIF and GPS metadata.

Use a source whose longest side is at least 800 pixels so the 800 file is not an enlargement. Only use a photo this project has rights to. See [Rights](#rights).

There is no `scripts/process-pin-image.js`. That helper does not exist yet. Producing the three sizes would need an image dependency, so it was left out of the photo-slot work. Run one of the commands below from the repo root. They write `frontend/public/pin-images/{PIN-ID}-96.webp`, `-320.webp`, and `-800.webp`.

ImageMagick 7 (`magick`). `-auto-orient` applies rotation before `-strip` removes EXIF and GPS. `-resize` fits inside the square. `-gravity center -extent` pads. The pad color is white. ImageMagick 6 uses `convert` with the same arguments. On ImageMagick 6.9 the WebP writer can ignore `-quality` and still emit lossy WebP near quality 75, which is the libwebp default. Use the `cwebp -q 75` command below when you need that number to be explicit.

```bash
PIN_ID=PIN-CF-01
SRC=photo.jpg
OUT=frontend/public/pin-images
mkdir -p "$OUT"
for SIZE in 96 320 800; do
  magick "$SRC" -auto-orient -strip \
    -resize "${SIZE}x${SIZE}" \
    -background white \
    -gravity center \
    -extent "${SIZE}x${SIZE}" \
    -quality 75 \
    "$OUT/${PIN_ID}-${SIZE}.webp"
done
```

To keep a transparent matte instead of white, use `-background none`. To avoid enlarging a small source, use `-resize "${SIZE}x${SIZE}>"` (the `>` must stay inside the quotes).

`cwebp` encodes and can drop metadata (`-q 75 -metadata none`). It does not center-pad. Pad with ImageMagick, then encode:

```bash
PIN_ID=PIN-CF-01
SRC=photo.jpg
OUT=frontend/public/pin-images
mkdir -p "$OUT"
for SIZE in 96 320 800; do
  magick "$SRC" -auto-orient -strip \
    -resize "${SIZE}x${SIZE}" \
    -background white \
    -gravity center \
    -extent "${SIZE}x${SIZE}" \
    "png32:$OUT/${PIN_ID}-${SIZE}.png"
  cwebp -q 75 -metadata none \
    "$OUT/${PIN_ID}-${SIZE}.png" \
    -o "$OUT/${PIN_ID}-${SIZE}.webp"
  rm "$OUT/${PIN_ID}-${SIZE}.png"
done
```

`sharp` is not a dependency of this repo. Install it in a scratch folder and run Node from that folder so the import resolves. `rotate()` applies EXIF orientation. `fit: "contain"` center-pads and does not crop. WebP output omits metadata unless you call `withMetadata()`. Run this from the repo root:

```bash
npm install --prefix /tmp/pin-sharp sharp
REPO="$PWD"
(
  cd /tmp/pin-sharp
  PIN_ID=PIN-CF-01 \
  SRC="$REPO/photo.jpg" \
  OUT="$REPO/frontend/public/pin-images" \
  node --input-type=module <<'EOF'
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const pinId = process.env.PIN_ID;
const src = process.env.SRC;
const outDir = process.env.OUT;
await mkdir(outDir, { recursive: true });
for (const size of [96, 320, 800]) {
  await sharp(src)
    .rotate()
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp({ quality: 75 })
    .toFile(`${outDir}/${pinId}-${size}.webp`);
}
EOF
)
```

## Turn a photo on

The app does not read this folder's file list. It reads `image` on the pin in `frontend/src/storyData/pins-catalog.json`. That field is copied from `scripts/data/pin-images.json` by the catalog generator. `frontend/src/data/collectibles.js` keeps `image` on the collectible only when it is an integer greater than 0.

1. Put the three WebP files in this folder.
2. Set that pin's version in `scripts/data/pin-images.json` under `pins`. Use a positive integer. `1` is the first published photo. Leave `meta` as it is.

```json
{
  "meta": {
    "description": "Pin id to photo version. A positive integer means files exist at that version. 0 or a missing id means no photo. The catalog generator copies positive versions onto pins as image."
  },
  "pins": {
    "PIN-CF-01": 1
  }
}
```

3. From the repo root (the directory with `package.json`), regenerate the catalog:

```bash
npm run generate:pins-catalog
```

`package.json` maps that script to `node scripts/generate-pins-catalog.js`. The script reads `scripts/data/pin-images.json` and rewrites `frontend/src/storyData/pins-catalog.json`. A positive integer is stored on that pin as `"image": 1` (or whatever version you set). The script logs `Applied pin image versions to N pins.`

Commit the three WebP files, `scripts/data/pin-images.json`, and the regenerated `frontend/src/storyData/pins-catalog.json` together. The next generator run overwrites a hand edit of the catalog.

The version has to be an integer `0` or greater. A fraction, a negative number, or a string makes the generator throw `Invalid pin image version for {id}` and it does not write the catalog. An id that is not a listed or retired pin is skipped with `Skipped pin image for {id}: not in catalog`. Listed pins are the ones in the collectibles browser. Retired pins are still resolved by id (a saved collection row can show the photo) and stay out of browse.

## Reshoot

Hosting sets this header on `/pin-images/**` in `firebase.json`:

`Cache-Control: public, max-age=31536000, immutable`

`31536000` seconds is one year. The URL includes `?v={version}`, and a reshoot bumps the version instead of reusing that URL. Replace the three WebP files (same names), set the id to the next integer (`1` becomes `2`), and run `npm run generate:pins-catalog` again. Requests then use `?v=2`.

Do not publish different pixels under a version that has already shipped. Clients can keep the immutable response for that `?v=` URL for a year.

## No photo

A pin with version `0`, or with no entry in `pins`, has no photo. The generator does not write `image` for those ids (`0` is skipped on purpose). The slot renders the no-photo tint and does not request a file.

The tint is a colored square from the set code (the middle part of the id, such as `CF` in `PIN-CF-01`). Small empty slots show that code and a camera icon, with the accessible name `no photo yet`. They are not links. The detail empty slot shows the code and `No photo yet. Have this pin?` with a link labeled `Send us a photo.` pointing at `/about`. While a photo is loading, the tint stays up. After the file loads, the photo fades in.

`"PIN-CF-01": 0` and omitting `PIN-CF-01` do the same thing. To take a photo back down, set `0` or delete the id, regenerate the catalog, and remove the WebP files if you do not want them on the site anymore.

## Rights

Commit only photos we have rights to use. That means photographs we took, or photos a collector sent us for ShardStash.

Do not put Dragonsteel store images in this folder. Do not hotlink `dragonsteelbooks.com`, and do not download their product photos into git. `storeUrl` on a pin is a link to a product page from `scripts/data/pin-dragonsteel-store-map.json`. It is not a photo source. `PinImage` only requests `/pin-images/{PIN-ID}-{size}.webp` on this site.

## This README on the site

This file lives under `frontend/public`, so a production build copies it to `frontend/dist/pin-images/README.md`. Hosting can serve that copy at `/pin-images/README.md`. It has no secrets. The `/pin-images/**` cache header applies to it too, so the hosted copy can sit immutable for a year. When the steps change, follow the copy in git.
