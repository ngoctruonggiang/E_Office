# `components/ui/Modal.tsx` — Modal

**Type:** Client Component

The base popup primitive, built on the native `<dialog>` element — so focus
trapping, `Esc` to close, and the backdrop are provided by the browser.

> For feature code, prefer the imperative
> [`useModal()`](../providers/ModalProvider.md) API. Use `Modal` directly only
> when you want a declarative, locally-controlled dialog.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controls visibility (`showModal()` / `close()`). |
| `onClose` | `() => void` | — | Called on Esc, backdrop click, or programmatic close. |
| `children` | `ReactNode` | — | Dialog content. |
| `dismissable` | `boolean` | `true` | Allow closing by clicking the backdrop. |

## Behavior

- An effect syncs the `open` prop to the dialog's imperative methods.
- Backdrop clicks are detected by checking `e.target === dialog`; clicks on
  inner content don't close it.
- Content is only mounted while `open` is true.

## Declarative usage

```tsx
const [open, setOpen] = useState(false);

<button onClick={() => setOpen(true)}>Edit</button>
<Modal open={open} onClose={() => setOpen(false)}>
  <EditForm onDone={() => setOpen(false)} />
</Modal>
```

## Related

- [ModalProvider](../providers/ModalProvider.md) — imperative `useModal()` API.
