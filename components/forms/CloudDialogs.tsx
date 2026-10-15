import { Button, Dialog, Text } from "../../ui";

/** Shown instead of silently launching the OS-browser sign-in (or a raw API error) when a Drive action is attempted signed out. */
export function GoogleAuthRequiredDialog({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      visible={visible}
      title="Sign in with Google"
      onClose={onCancel}
      footer={<><Button label="Cancel" variant="ghost" onPress={onCancel} /><Button label="Sign in with Google" variant="primary" onPress={onConfirm} /></>}
    >
      <Text tone="secondary">Sign in with Google to use your forms from Google Drive. They are stored in a private folder in your own Drive that only this app can see. Sign-in opens in your browser.</Text>
    </Dialog>
  );
}
