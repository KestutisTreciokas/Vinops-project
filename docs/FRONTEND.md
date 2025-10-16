# FRONTEND UI Spec — vinops.online

**Updated:** (Europe/Warsaw)

## VIN-chip (Copy)
- Placement: right of `<h1>` on VIN page.
- Component: `components/VinChipCopy.tsx`
- Label/ARIA: `aria-label="Copy VIN"`; title localized: EN "Copy VIN", RU "Скопировать VIN".
- Keyboard: button element; **Enter**/**Space** activate copy.
- Behavior: copies **UPPERCASE** VIN to clipboard, shows transient success state.
- Visual: matches "Copy number" button in Lot info (size/contrast/focus outline).

### States
- Idle → Hover → Focus-visible → Active (copied)
- Add screenshot references here after QA run.

