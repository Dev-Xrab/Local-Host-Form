import { useState } from "react";
import { Image, View } from "react-native";
import { ImagePlus } from "lucide-react-native";
import { Notice } from "../../ui";
import { GButton, GCard, GLineInput, GText, useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { pickImageDataUri } from "../../lib/platform";
import { useEditorSelection } from "./EditorSelection";
import { FloatingToolbar } from "./FloatingToolbar";
import { useLayout } from "../../ui";

/** Google Forms header card: purple top strip, big title, description, optional banner. */
export function FormHeader() {
  const g = useGF();
  const title = useFormStore((s) => s.formTitle);
  const description = useFormStore((s) => s.formDescription);
  const banner = useFormStore((s) => s.bannerImage);
  const { setFormTitle, setFormDescription, setBannerImage } = useFormActions();
  const { selectedId, setSelectedId } = useEditorSelection();
  const selected = selectedId === "form-header";
  const { width } = useLayout();
  const [error, setError] = useState<string | null>(null);

  // Same inline base64 approach as a question's own image: no upload endpoint, the data: URI
  // rides along with the rest of the form on Save.
  const choose = async () => {
    setError(null);
    try {
      const uri = await pickImageDataUri();
      if (uri) setBannerImage(uri);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View nativeID="question-form-header" onTouchStart={() => setSelectedId("form-header")} style={{ position: "relative", zIndex: selected ? 5 : 1 }}>
      {selected && width >= 940 ? <View style={{ position: "absolute", right: -68, top: 0, zIndex: 6 }}><FloatingToolbar /></View> : null}
      <GCard accent style={selected ? ({ boxShadow: g.shadow } as object) : undefined}>
        {selected ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 10, bottom: 0, width: 6, backgroundColor: g.bar }} /> : null}
        {banner ? (
          <View style={{ width: "100%", aspectRatio: 3.5 }}>
            <Image source={{ uri: banner }} accessibilityLabel="Form banner" resizeMode="cover" onError={() => setError("The banner image could not be displayed. Replace it or remove it.")} style={{ width: "100%", height: "100%" }} />
          </View>
        ) : null}
        <View style={{ padding: 24, gap: 12 }}>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <GLineInput quiet autoGrow fontSize={32} weight="400" placeholder="Untitled form" value={title} onChangeText={setFormTitle} onFocus={() => setSelectedId("form-header")} />
          <GLineInput quiet autoGrow fontSize={14} placeholder="Form description" value={description} onChangeText={setFormDescription} onFocus={() => setSelectedId("form-header")} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <GButton variant="outlined" label={banner ? "Replace banner image" : "Add banner image"} icon={<ImagePlus size={16} color={g.accent} />} onPress={choose} />
            {banner ? <GButton label="Remove banner" onPress={() => setBannerImage(null)} /> : null}
          </View>
          <GText size={12} secondary>Respondents will see "* Indicates required question" under this description.</GText>
        </View>
      </GCard>
    </View>
  );
}
