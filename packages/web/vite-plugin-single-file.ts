// Los tipos de Rollup se toman de `vite`, que los reexporta: rollup no es una
// dependencia directa de este paquete y no se resuelve por su nombre.
import type { Plugin, Rollup } from 'vite';

type OutputAsset = Rollup.OutputAsset;
type OutputBundle = Rollup.OutputBundle;
type OutputChunk = Rollup.OutputChunk;

/**
 * Folds the built CSS and JS into `index.html`, leaving one self-contained file.
 *
 * The motive is not payload size. Opening `index.html` with a double click
 * makes the page's origin `null`, and the browser then refuses to load a
 * sibling script or stylesheet across that origin — CORS only allows
 * http/https/data/chrome. With nothing left to fetch the restriction stops
 * applying, so the unzipped folder works both from `file://` and over HTTP.
 *
 * Inline code is exempt from that check, so the `<script>` can stay a module.
 */
export function singleFile(): Plugin {
  return {
    name: 'mutadiff:single-file',
    // After Vite has rewritten the asset URLs into the HTML.
    enforce: 'post',
    apply: 'build',

    generateBundle(_options, bundle) {
      const html = findHtml(bundle);
      let source = asText(html.source);

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output === html) continue;

        if (output.type === 'chunk') {
          source = replaceOnce(source, scriptTag(fileName), inlineScript(output), fileName);
        } else if (fileName.endsWith('.css')) {
          source = replaceOnce(source, linkTag(fileName), inlineStyle(output), fileName);
        } else {
          // Anything else would stay a separate file and quietly reintroduce the
          // very fetch this plugin exists to remove. `assetsInlineLimit` in
          // vite.config.ts should have turned it into a data URI already.
          throw new Error(
            `single-file: "${fileName}" cannot be inlined; raise assetsInlineLimit or extend this plugin`,
          );
        }

        delete bundle[fileName];
      }

      html.source = source;
    },
  };
}

function findHtml(bundle: OutputBundle): OutputAsset {
  const html = Object.values(bundle).find(
    (output): output is OutputAsset => output.type === 'asset' && output.fileName.endsWith('.html'),
  );
  if (!html) {
    throw new Error('single-file: the bundle has no HTML entry to inline into');
  }
  return html;
}

/** `TextDecoder` y no `Buffer`: este paquete se tipa sin los globals de Node. */
function asText(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}

/**
 * `</script` inside the injected code would close the block early. A backslash
 * before the slash is an identity escape in JS — valid inside strings, template
 * literals and regexes alike — so the code keeps its meaning.
 */
function inlineScript(chunk: OutputChunk): string {
  return `<script type="module">${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
}

function inlineStyle(asset: OutputAsset): string {
  return `<style>${asText(asset.source).replace(/<\/style/gi, '<\\/style')}</style>`;
}

function scriptTag(fileName: string): RegExp {
  return new RegExp(`<script[^>]*\\bsrc="[^"]*${escapeRegExp(fileName)}"[^>]*>\\s*</script>`, 'i');
}

function linkTag(fileName: string): RegExp {
  return new RegExp(`<link[^>]*\\bhref="[^"]*${escapeRegExp(fileName)}"[^>]*>`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replacing without matching would drop the asset from the bundle while leaving
 * the tag pointing at a file that no longer exists — a blank page that only
 * shows up after packaging. Better to fail the build.
 *
 * The replacement goes through a function so `$&`, `$1` and friends inside the
 * bundled code are not treated as substitution patterns.
 */
function replaceOnce(
  source: string,
  pattern: RegExp,
  replacement: string,
  fileName: string,
): string {
  if (!pattern.test(source)) {
    throw new Error(`single-file: no tag in index.html references "${fileName}"`);
  }
  return source.replace(pattern, () => replacement);
}
