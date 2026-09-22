/**
 * Hands a file built in the browser over as a download. There is no server to
 * send a `Content-Disposition`, so the file name has its source of truth here.
 *
 * The object URL is revoked right after the click: the browser has already
 * taken the blob by then, and keeping the URL would hold the whole file in
 * memory for the life of the tab.
 */
export function downloadFile(content: string, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
