// Ilustraciones vectoriales propias; no representan fotografías del catálogo.
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("public/demo", { recursive: true });
const shapes = {
  hoodie:
    '<path d="M151 142 Q151 64 220 64 Q289 64 289 142 L330 157 L386 306 L324 333 L296 249 L300 460 L140 460 L144 249 L116 333 L54 306 L110 157Z"/><path d="M174 135 Q220 172 266 135 M172 359 L268 359 L278 413 L162 413Z" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="3"/><path d="M202 160 L199 242 M238 160 L241 242" stroke="#b4a18b" stroke-width="3"/>',
  tee: '<path d="M165 110 Q220 148 275 110 L365 162 L325 251 L278 225 L290 460 L150 460 L162 225 L115 251 L75 162Z"/><path d="M184 119 Q220 178 256 119" fill="none" stroke="#b4a18b" stroke-width="5"/><text x="220" y="241" text-anchor="middle" fill="#b4a18b" font-family="sans-serif" font-size="12" letter-spacing="4">JOSWEAR</text>',
  pants:
    '<path d="M145 81 L295 81 L324 475 L242 475 L220 234 L198 475 L116 475Z"/><path d="M145 109 L295 109 M220 109 L220 234 M128 252 L185 252 L183 322 L125 322 M255 252 L312 252 L315 322 L257 322" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="3"/>',
  cap: '<path d="M105 294 Q98 145 220 143 Q340 143 333 294Z"/><path d="M111 291 Q223 259 333 294 Q388 332 391 358 Q258 384 111 309Z"/><path d="M220 145 L220 281 M113 284 Q220 248 328 284" fill="none" stroke="#ffffff" stroke-opacity=".2" stroke-width="3"/><text x="220" y="250" text-anchor="middle" fill="#b4a18b" font-family="sans-serif" font-size="13" letter-spacing="3">JW</text>',
};
for (const [name, shape] of Object.entries(shapes))
  for (const back of [false, true]) {
    const color =
      name === "tee" ? "#ded5c6" : name === "pants" ? "#97856f" : "#282725";
    writeFileSync(
      `public/demo/${name}${back ? "-back" : ""}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="560" viewBox="0 0 440 560"><defs><filter id="s"><feDropShadow dx="4" dy="18" stdDeviation="14" flood-opacity=".13"/></filter><linearGradient id="b" x2="1" y2="1"><stop stop-color="#eee9e0"/><stop offset="1" stop-color="#ded6c9"/></linearGradient></defs><rect width="440" height="560" fill="url(#b)"/><ellipse cx="220" cy="490" rx="117" ry="12" fill="#171717" opacity=".05"/><g fill="${color}" filter="url(#s)" transform="${back ? "translate(440 0) scale(-1 1)" : ""}">${shape}</g><text x="22" y="536" font-family="sans-serif" font-size="8" fill="#756b5f" letter-spacing="2">ESTUDIO JOSWEAR / ILUSTRACIÓN DEMO</text></svg>`,
    );
  }
