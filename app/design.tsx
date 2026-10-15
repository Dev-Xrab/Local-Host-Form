// Component gallery used for visual QA of the design system. Not linked from the product UI.
import { useState } from "react";
import { Inbox, Plus, Trash2 } from "lucide-react-native";
import {
  Badge, Button, Checkbox, ConfirmDialog, Dialog, EmptyState, IconButton, Notice, Page, PageHeader, Radio, SegmentedControl,
  Section, Select, Skeleton, Spinner, Surface, Switch, Tabs, TextField, useToast, Row, Text,
} from "../ui";

export default function Gallery() {
  const toast = useToast();
  const [seg, setSeg] = useState("forms");
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState<string | null>("a");
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <Page maxWidth={860}>
      <PageHeader title="Design system" subtitle="Every shared component, in one place." actions={<Button label="New form" icon={Plus} variant="primary" onPress={() => toast("Form created", "success")} />} />

      <Section title="Buttons">
        <Row wrap>
          <Button label="Primary" variant="primary" />
          <Button label="Secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Delete" variant="danger" />
          <Button label="Loading" variant="primary" loading />
          <Button label="Disabled" disabled />
          <IconButton icon={Trash2} label="Delete" tone="danger" />
        </Row>
      </Section>

      <Section title="Inputs">
        <Surface>
          <TextField label="Form title" placeholder="Untitled form" hint="Shown to respondents." />
          <TextField label="Password" secureTextEntry error="Password must be at least 8 characters." />
          <TextField label="Description" multiline rows={3} />
          <Select label="Subject" value={sel} onChange={setSel} options={[{ value: "a", label: "Mathematics" }, { value: "b", label: "Physics" }]} />
        </Surface>
      </Section>

      <Section title="Selection">
        <Surface>
          <Checkbox label="Shuffle questions" checked={checked} onChange={setChecked} />
          <Radio label="One response per student" checked={!on} onChange={() => setOn(false)} />
          <Radio label="Allow retakes" checked={on} onChange={() => setOn(true)} />
          <Switch label="Restrict copying" description="Blocks copy and paste while answering." checked={on} onChange={setOn} />
        </Surface>
      </Section>

      <Section title="Navigation">
        <SegmentedControl value={seg} onChange={setSeg} options={[{ value: "forms", label: "Forms" }, { value: "sessions", label: "Sessions", count: 3 }]} />
        <Tabs value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "open", label: "Open", count: 2 }, { value: "closed", label: "Closed" }]} />
      </Section>

      <Section title="Feedback">
        <Notice tone="info" title="Syncing">Your forms will sync when the cloud connection is back.</Notice>
        <Notice tone="danger" title="Couldn't save" actionLabel="Retry" onAction={() => {}}>The local server didn't respond.</Notice>
        <Row wrap><Badge label="Open" tone="success" /><Badge label="Draft" /><Badge label="Ended" tone="warning" /><Badge label="Error" tone="danger" /></Row>
        <Surface><Skeleton height={14} width="60%" /><Skeleton height={14} /></Surface>
        <Spinner label="Loading forms" />
        <Surface><EmptyState icon={Inbox} title="No responses yet" body="Share the session link and answers will show up here." actionLabel="Copy link" onAction={() => toast("Link copied", "success")} /></Surface>
      </Section>

      <Section title="Overlays">
        <Row wrap>
          <Button label="Open dialog" onPress={() => setOpen(true)} />
          <Button label="Confirm delete" variant="danger" onPress={() => setConfirm(true)} />
          <Button label="Show toast" onPress={() => toast("Saved")} />
        </Row>
        <Text variant="small" tone="tertiary">On phones, dialogs become bottom sheets.</Text>
      </Section>

      <Dialog visible={open} title="Rename form" onClose={() => setOpen(false)} footer={<><Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} /><Button label="Save" variant="primary" onPress={() => setOpen(false)} /></>}>
        <TextField label="Title" defaultValue="Midterm — Algebra" />
      </Dialog>
      <ConfirmDialog visible={confirm} title="Delete form?" message="This also deletes its responses. This can't be undone." confirmLabel="Delete" destructive onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />
    </Page>
  );
}
