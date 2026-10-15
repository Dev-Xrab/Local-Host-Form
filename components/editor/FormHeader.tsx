import { useState } from "react";
import { Image, View } from "react-native";
import { ImagePlus } from "lucide-react-native";
import { Button, InlineInput, Notice, Surface, space } from "../../ui";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { pickImageDataUri } from "../../lib/platform";

/** Optional banner, then the form's title and description, edited in place. */
export function FormHeader() {
  const title = useFormStore((s) => s.formTitle);
  const description = useFormStore((s) => s.formDescription);
  const banner = useFormStore((s) => s.bannerImage);
  const { setFormTitle, setFormDescription, setBannerImage } = useFormActions();
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
    <Surface padded={false}>
      {banner ? <Image source={{ uri: banner }} accessibilityLabel="Form banner" resizeMode="cover" style={{ width: "100%", height: 140 }} /> : null}
      <View style={{ padding: space[4], gap: space[2] }}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <InlineInput variant="heading" placeholder="Form title" value={title} onChangeText={setFormTitle} autoGrow />
        <InlineInput placeholder="Form description" value={description} onChangeText={setFormDescription} autoGrow />
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Button label={banner ? "Replace banner" : "Add banner image"} icon={ImagePlus} compact variant="ghost" onPress={choose} />
          {banner ? <Button label="Remove banner" compact variant="ghost" onPress={() => setBannerImage(null)} /> : null}
        </View>
      </View>
    </Surface>
  );
}
