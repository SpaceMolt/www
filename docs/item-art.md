# Item codex artwork

Item detail pages use `images/items/<item-id>.webp` in the public
`spacemolt-assets` R2 bucket. Images stay outside Git. Use square WebP files;
the page contains the full image without cropping and links to the original.

After uploading approved artwork, regenerate `src/data/imageManifest.json`
with the existing R2 manifest workflow in `src/data/images.ts`. Pages only
show published keys in that manifest. Missing images leave the description,
stats, and recipes available; failed image requests also hide the art panel.

For local review before upload, serve the approved WebP directory and set
`ITEM_ART_PREVIEW_URL` in `.env.local` to its URL. This override is restricted
to development and does not enable artwork in production builds.

Upload the assets and update the manifest before publishing the feature.
