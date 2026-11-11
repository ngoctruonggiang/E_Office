# `components/providers/ModalProvider.tsx` — ModalProvider

**Type:** Client Component (context provider)

The app-wide **popup mechanism**. Any feature can open a popup imperatively with
arbitrary content, without rendering or wiring its own `<Modal>`. Built on top
of [`Modal`](../ui/Modal.md).

## Provider

```tsx
<ModalProvider>{children}</ModalProvider>
```

Already mounted in `app/(main)/layout.tsx`. It renders a single shared `Modal`
and shows whatever content the latest `open()` call passed.

## `useModal()`

| Member | Type | Description |
|--------|------|-------------|
| `open` | `(content: ReactNode, options?: { dismissable?: boolean }) => void` | Open a popup with the given content. |
| `close` | `() => void` | Close the current popup. |
| `isOpen` | `boolean` | Whether a popup is currently shown. |

Throws if used outside a `ModalProvider`.

## Usage

```tsx
function DeleteButton({ id }: { id: string }) {
  const { open, close } = useModal();

  return (
    <button
      onClick={() =>
        open(
          <ConfirmDialog
            message="Delete this item?"
            onConfirm={() => {
              /* ...delete... */
              close();
            }}
            onCancel={close}
          />,
        )
      }
    >
      Delete
    </button>
  );
}
```

### Non-dismissable popups

```tsx
open(<RequiredForm />, { dismissable: false }); // backdrop click won't close
```

## Notes

- Only one popup shows at a time; a new `open()` replaces the current content.
- Content is passed as a React node, so you keep full control of layout and the
  close behavior (call `close()` from inside your content).

## Related

- [Modal](../ui/Modal.md)
