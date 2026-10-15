import { AlignLeft, CalendarDays, CheckSquare, ChevronDownSquare, CircleDot, Clock, Grid3x3, Rows3, Sliders, Text, Upload } from "lucide-react-native";
import type { IconComponent } from "../ui";

// Keys come from QUESTION_TYPE_META.icon in src/lib/questionTypes.js.
export const QUESTION_ICONS: Record<string, IconComponent> = {
  shortAnswer: Text,
  paragraph: AlignLeft,
  multipleChoice: CircleDot,
  checkboxes: CheckSquare,
  dropdown: ChevronDownSquare,
  linearScale: Sliders,
  date: CalendarDays,
  time: Clock,
  fileUpload: Upload,
  grid: Grid3x3,
};

export const SectionIcon: IconComponent = Rows3;
