"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";

// A QR code for a recipient link. The link still requires the named recipient to sign in; the code carries no data of its own beyond the address.
export function RecipientQr({ url }: { url: string }) {
  const { t } = useI18n();
  const [image, setImage] = useState<string | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    import("qrcode").then(({ default: QR }) => QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 200 })).then(value => { if (active) setImage(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url]);
  return <div>{failed ? <p role="alert">{t("sh.qrFail")}</p> : image ? <img src={image} width={200} height={200} alt={t("sh.qrAlt")} /> : null}<p>{t("sh.qrNote")}</p></div>;
}
