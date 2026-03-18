import type { Metadata } from "next";

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

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: { zh: `/zh/${path}`, "zh-Hant": `/zh-hant/${path}` },
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: `/${locale}/${path}`,
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
    },
  };
}
