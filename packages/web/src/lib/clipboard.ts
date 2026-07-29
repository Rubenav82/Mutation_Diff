/**
 * Copies text, working on plain HTTP as well as HTTPS.
 *
 * `navigator.clipboard` is only exposed in a secure context. MutaDiff ships as
 * a folder of static files that an internal server may well hand out over plain
 * HTTP, where the whole API is simply absent — so this is not a polyfill for
 * old browsers, it is the difference between the copy button working and
 * throwing a TypeError on the deployment we are targeting.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Off-screen rather than hidden: `display: none` or `hidden` would make the
  // selection impossible, which is the one thing this node exists for.
  textarea.style.position = 'fixed';
  textarea.style.top = '-100vh';
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}
