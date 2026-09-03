import { Icons } from "../icons";

export default function DateField() {
  return (
    <div className="field-preview field-icon-preview">
      <Icons.date className="field-icon" />
      Month, Day, Year
    </div>
  );
}
