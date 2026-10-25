# Your own portraits

Pictures in this folder stay on your machine: git ignores everything here but this note.

Name a picture after a person's id and it replaces that person's woodcut:

- `zhuge-liang.png` replaces it in every book;
- `sanguozhi/zhuge-liang.png` replaces it in the 三国志 only.

The ids are the `id` fields in `data/<book>/people.json`. PNG, JPEG, WebP, GIF and AVIF all work.
The list is made when `npm run dev` or `npm run build` starts. If the dev server is already running,
run `node pipeline/local-portraits.mjs` and reload the page.
