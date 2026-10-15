import { useLocalSearchParams } from "expo-router";
import { RespondScreen } from "../../components/respond/RespondScreen";

// Public route: respondents open /s/:code (no host login). Same URL as before, so shared links keep working.
export default function Respond() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <RespondScreen code={code} />;
}
