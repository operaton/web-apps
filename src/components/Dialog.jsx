import { useRef } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { useTranslation } from "react-i18next";
import * as Icons from "../assets/icons.jsx";

/**
 * A modal dialog controlled by a boolean `open` signal. Opening/closing the
 * native <dialog> stays in sync with the signal, and closing it (Esc, backdrop,
 * close button) resets the signal to false.
 *
 * @param open {import("@preact/signals").Signal<boolean>}
 */
const Dialog = ({ open, title, hide_header = false, children }) => {
  const [t] = useTranslation(),
    ref = useRef(null);

  useSignalEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open.value && !dialog.open) dialog.showModal();
    else if (!open.value && dialog.open) dialog.close();
  });

  return (
    <dialog ref={ref} onClose={() => (open.value = false)}>
      {!hide_header && (
        <header>
          {title ? <h2>{title}</h2> : <span />}
          <button
            type="button"
            onClick={() => (open.value = false)}
            aria-label={t("common.close")}
          >
            <Icons.close />
            {t("common.close")}
          </button>
        </header>
      )}
      {children}
    </dialog>
  );
};

/**
 * A confirmation dialog with a danger action and a cancel button.
 *
 * @param open {import("@preact/signals").Signal<boolean>}
 * @param on_confirm called when the user confirms; the dialog then closes
 */
const ConfirmDialog = ({
  open,
  message,
  on_confirm,
  confirm_label,
  cancel_label,
}) => {
  const [t] = useTranslation();

  // The dismiss button and Esc already close the dialog, so the header's close
  // button would be a redundant third dismiss control — hide it here.
  return (
    <Dialog open={open} hide_header>
      <p>{message}</p>
      <div class="button-group">
        <button
          class="danger"
          onClick={() => {
            on_confirm();
            open.value = false;
          }}
        >
          {confirm_label ?? t("common.delete")}
        </button>
        <button onClick={() => (open.value = false)}>
          {cancel_label ?? t("common.cancel")}
        </button>
      </div>
    </Dialog>
  );
};

export { Dialog, ConfirmDialog };
