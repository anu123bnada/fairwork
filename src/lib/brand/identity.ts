import assets from "./assets.json";
import { brandManifestSchema } from "./contract";

export const brandManifest = brandManifestSchema.parse(assets);
export const approvedBrand = brandManifest.identity;
