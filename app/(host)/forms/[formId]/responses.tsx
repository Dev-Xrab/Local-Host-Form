import { useLocalSearchParams } from "expo-router";
import { ResponsesScreen } from "../../../../components/editor/ResponsesScreen";

export default function Responses() {
  const { formId } = useLocalSearchParams<{ formId: string }>();
  return <ResponsesScreen formId={formId} />;
}
