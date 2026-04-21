import type { Metadata } from "next";

const CN_SITE_NAME = "Tools By AI";
/** Chinese locale to OG format (standalone, no routing dependency) */
const CN_OG_LOCALE: Record<string, string> = { zh: "zh_CN", "zh-hant": "zh_TW" };

/**
 * Generate locale-aware metadata for Chinese-only tool pages.
 * Auto-converts Simplified Chinese metadata to Traditional for zh-hant.
 * Standalone: no i18n routing dependency, safe for sub-projects.
 */
export async function generateChineseToolMetadata({
  locale,
  title,
  description,
  keywords,
  path,
}: {
  locale: string;
  title: string;
  description: string;
  keywords: string;
  path: string;
}): Promise<Metadata> {
  let finalTitle = title;
  let finalDescription = description;
  let finalKeywords = keywords;

  if (locale === "zh-hant") {
    const { createConverter } = await import("js-opencc");
    const converter = await createConverter({ from: "cn", to: "t" });
    finalTitle = converter(title);
    finalDescription = converter(description);
    finalKeywords = converter(keywords);
  }

  const ogLocale = CN_OG_LOCALE[locale] ?? "zh_CN";
  const alternateLocale = locale === "zh" ? ["zh_TW"] : ["zh_CN"];

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: { "x-default": `/zh/${path}`, zh: `/zh/${path}`, "zh-Hant": `/zh-hant/${path}` },
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: `/${locale}/${path}`,
      siteName: CN_SITE_NAME,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: finalTitle }],
      locale: ogLocale,
      alternateLocale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: ["/og-image.png"],
    },
  };
}
