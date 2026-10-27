import { Platform } from "react-native";

// Adds a picked file or photo to a FormData in the way each platform needs
export async function appendAsset(
  form,
  field,
  asset,
  fallbackName,
  fallbackType,
) {
  const name = asset.fileName || asset.name || fallbackName;

  if (asset.file) {
    form.append(field, asset.file); // web: a real File object
    return;
  }

  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob(); // web: a blob URL
    form.append(field, blob, name);
    return;
  }

  // Android and iPhone describe the file by its location
  form.append(field, {
    uri: asset.uri,
    name,
    type: asset.mimeType || fallbackType,
  });
}
