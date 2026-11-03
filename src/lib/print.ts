// Print/PDF windows are standalone HTML documents, so they don't get the app's
// self-hosted Roboto — each one loads it from Google Fonts with this tag.
export const ROBOTO_LINK =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">'

export const PRINT_FONT = "Roboto, Arial, sans-serif"

// Opens the print dialog once the window (and its Roboto font) has finished loading,
// so the printout isn't rendered in a fallback font. Gives up waiting after 3s.
export function printWhenReady(win: Window) {
  let done = false
  const print = () => {
    if (done) return
    done = true
    try { win.print() } catch { /* user can print manually */ }
  }
  const afterLoad = () => {
    const fonts = (win.document as any).fonts
    if (fonts?.ready) fonts.ready.then(() => setTimeout(print, 50))
    else setTimeout(print, 300)
  }
  if (win.document.readyState === 'complete') afterLoad()
  else win.addEventListener('load', afterLoad)
  setTimeout(print, 3000)
}
