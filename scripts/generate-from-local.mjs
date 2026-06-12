import fs from "node:fs";
import path from "node:path";
import * as parse5 from "parse5";
import { markdownToPortableText } from "emdash/client";

const projectRoot = path.resolve(process.cwd(), "..");
const stagingRoot = process.cwd();
const localRoot = path.join(projectRoot, "local");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
};

const normalizeAssetPaths = (html) =>
  html
    .replaceAll("../../assets/", "/assets/")
    .replaceAll("../assets/", "/assets/")
    .replaceAll("./assets/", "/assets/")
    .replaceAll('href="../index.html"', 'href="/"')
    .replaceAll('href="./index.html"', 'href="/"')
    .replaceAll('href="index.html"', 'href="/"');

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const safeFile = (value) => slugify(value || "page") || "page";

const extractBetween = (html, startPattern, endPattern, fromIndex = 0) => {
  const start = html.search(startPattern);
  if (start === -1) return "";
  const afterStart = html.indexOf(">", start) + 1;
  const end = html.indexOf(endPattern, afterStart);
  return end === -1 ? "" : html.slice(afterStart, end);
};

const extractMainInner = (html) => {
  const mainStart = html.indexOf("<main");
  if (mainStart === -1) return "";
  const innerStart = html.indexOf(">", mainStart) + 1;
  const end = html.indexOf("</main>", innerStart);
  return end === -1 ? "" : html.slice(innerStart, end);
};

const extractTag = (html, tagName, className) => {
  const classPattern = new RegExp(`<${tagName}\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`, "i");
  const match = classPattern.exec(html);
  if (!match) return null;
  const openEnd = html.indexOf(">", match.index) + 1;
  let cursor = openEnd;
  let depth = 1;
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = openEnd;
  while (depth > 0) {
    const tag = tagPattern.exec(html);
    if (!tag) return null;
    if (tag[0].startsWith("</")) depth -= 1;
    else depth += 1;
    cursor = tagPattern.lastIndex;
  }
  return {
    start: match.index,
    innerStart: openEnd,
    innerEnd: cursor - `</${tagName}>`.length,
    end: cursor,
    outer: html.slice(match.index, cursor),
    inner: html.slice(openEnd, cursor - `</${tagName}>`.length)
  };
};

const stripToc = (html) => html.replace(/<div class="toc-container">[\s\S]*?<\/div>\s*/i, "");

const splitIntroContent = (html) => {
  const withoutToc = stripToc(html).trim();
  const firstHeading = withoutToc.search(/<h2\b/i);
  if (firstHeading === -1) return { introHtml: "", contentHtml: withoutToc };
  return {
    introHtml: withoutToc.slice(0, firstHeading).trim(),
    contentHtml: withoutToc.slice(firstHeading).trim()
  };
};

const textContent = (node) => {
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(textContent).join("");
};

const attrs = (node) => Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));

const inlineMarkdown = (nodes) =>
  (nodes || [])
    .map((node) => {
      if (node.nodeName === "#text") return node.value || "";
      const value = inlineMarkdown(node.childNodes || []);
      if (!value.trim()) return value;
      if (node.tagName === "strong" || node.tagName === "b") return `**${value.trim()}**`;
      if (node.tagName === "em" || node.tagName === "i") return `_${value.trim()}_`;
      if (node.tagName === "a") {
        const href = attrs(node).href || "#";
        return `[${value.trim()}](${href})`;
      }
      if (node.tagName === "br") return "\n";
      return value;
    })
    .join("")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");

const blockToMarkdown = (node, lines = [], listLevel = 0) => {
  if (node.nodeName === "#text") return lines;
  const tag = node.tagName;
  if (!tag) {
    (node.childNodes || []).forEach((child) => blockToMarkdown(child, lines, listLevel));
    return lines;
  }

  if (/^h[1-6]$/.test(tag)) {
    lines.push(`${"#".repeat(Number(tag.slice(1)))} ${inlineMarkdown(node.childNodes).trim()}`);
    lines.push("");
    return lines;
  }

  if (tag === "p") {
    const text = inlineMarkdown(node.childNodes).trim();
    if (text) {
      lines.push(text);
      lines.push("");
    }
    return lines;
  }

  if (tag === "ul" || tag === "ol") {
    (node.childNodes || []).forEach((child) => blockToMarkdown(child, lines, listLevel + 1));
    lines.push("");
    return lines;
  }

  if (tag === "li") {
    const direct = (node.childNodes || []).filter((child) => child.tagName !== "ul" && child.tagName !== "ol");
    const text = inlineMarkdown(direct).trim();
    if (text) lines.push(`${"  ".repeat(Math.max(0, listLevel - 1))}- ${text}`);
    (node.childNodes || [])
      .filter((child) => child.tagName === "ul" || child.tagName === "ol")
      .forEach((child) => blockToMarkdown(child, lines, listLevel + 1));
    return lines;
  }

  if (tag === "blockquote") {
    const text = inlineMarkdown(node.childNodes).trim();
    if (text) {
      lines.push(`> ${text}`);
      lines.push("");
    }
    return lines;
  }

  (node.childNodes || []).forEach((child) => blockToMarkdown(child, lines, listLevel));
  return lines;
};

const htmlToPortableText = (html) => {
  const fragment = parse5.parseFragment(html || "");
  const markdown = blockToMarkdown(fragment).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return markdown ? markdownToPortableText(markdown) : [];
};

const metaTitle = (html) => {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decode(match[1].trim()) : "";
};

const metaDescription = (html) => {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return match ? decode(match[1].trim()) : "";
};

const h1Title = (html) => {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? textOnly(match[1]) : "";
};

const textOnly = (html) =>
  decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, "-");

const dynamicPages = {
  internal_pages: [
    ["Audiology Services.html", "audiology-services"],
    ["Choosing a Hearing Aid in Arvada & Littleton, CO.html", "hearing-aids-products/choosing-a-hearing-aid"],
    ["Communication Training Program in Arvada & Littleton, CO.html", "audiology-services/communication-training-program"],
    ["Custom Earmolds in Arvada & Littleton, CO.html", "audiology-services/custom-earmolds"],
    ["Ear Wax Removal in Arvada & Littleton, CO.html", "audiology-services/ear-wax-removal"],
    ["Frequently Asked Questions About Hearing Care.html", "resources/faq"],
    ["Giving Back - Hearing The Call.html", "give-back/hearing-the-call"],
    ["Hear It Forward Membership.html", "give-back/hear-it-forward"],
    ["Hearing Aid Accessories in Arvada & Littleton, CO.html", "hearing-aids-products/hearing-aid-accessories"],
    ["Hearing Aid Fittings in Arvada & Littleton, CO.html", "hearing-aids-products/hearing-aid-fittings"],
    ["Hearing Aid Funding Resources.html", "patient-resources/hearing-aid-funding-resources"],
    ["Hearing Aid Repairs in Arvada & Littleton, CO.html", "hearing-aids-products/hearing-aid-repairs-maintenance"],
    ["Hearing Aid Services.html", "hearing-aid-services"],
    ["Hearing Aid Styles in Arvada & Littleton, CO.html", "hearing-aids-products/hearing-aid-styles"],
    ["Hearing Aids and Products in Arvada & Littleton, CO.html", "hearing-aids-products"],
    ["Hearing Loss Association of America Denver Chapter.html", "patient-resources/hearing-loss-association-of-america"],
    ["Hearing Loss Facts.html", "hearing-loss/hearing-loss-facts"],
    ["Hearing Loss in Arvada & Littleton, CO.html", "hearing-loss"],
    ["Hearing Assessments.html", "audiology-services/hearing-assessments"],
    ["How We Hear.html", "hearing-loss/how-we-hear"],
    ["Insurance and Billing Information (Arvada and Littleton).html", "resources/insurance"],
    ["LACE AI Pro in Arvada & Littleton, CO - Train Your Brain to Hear Speech More Clearly.html", "audiology-services/lace-ai-pro-auditory-training"],
    ["Online Hearing Tests.html", "online-hearing-tests"],
    ["New Leaf Hearing Care Privacy Policy.html", "privacy-policy"],
    ["Protecting Your Hearing.html", "hearing-loss/protecting-your-hearing"],
    ["Research Linking Untreated Hearing Loss to Dementia Risk and Falls.html", "research-linking-untreated-hearing-loss-to-dementia-risk-and-falls"],
    ["TERMS OF SERVICE.html", "terms-of-service"],
    ["Tinnitus Evaluation and Management in Littleton & Arvada, CO.html", "audiology-services/tinnitus-evaluation-management"]
  ],
  hearing_aids: [
    ["Oticon Hearing Aids.html", "oticon-hearing-aids"],
    ["Phonak Hearing Aids.html", "phonak-hearing-aids"],
    ["ReSound Hearing Aids.html", "resound-hearing-aids"],
    ["Signia Hearing Aids.html", "signia-hearing-aids"],
    ["Starkey Hearing Aids.html", "starkey-hearing-aids"],
    ["Unitron Hearing Aids.html", "unitron-hearing-aids"],
    ["Widex Hearing Aids.html", "widex-hearing-aids"]
  ],
  team: [
    ["Dusty Jessen, Au.D.html", "audiologist/dusty-jessen", "Practice Owner & Director of Audiology", "new-leaf-hearing-care-dusty.webp"],
    ["Julie Raney, M.S.html", "audiologist/julie-raney", "Audiologist", "new-leaf-hearing-care-julie.webp"],
    ["Lisa Marie Bell, Au.D.html", "audiologist/lisa-marie-bell", "Audiologist", "new-leaf-hearing-care-lisa.webp"],
    ["Rose Young.html", "patient-care-coordinator/rose-young", "Patient Care Coordinator", "new-leaf-hearing-care-rose.webp"]
  ],
  blog_posts: []
};

const staticPages = [
  ["index.html", "index.astro", "New Leaf Hearing Care | Audiologist & Hearing Aids in Colorado", "New Leaf Hearing Care is an audiology and hearing aid clinic with expert audiologists providing hearing tests and professional hearing services in Arvada, CO and Littleton, CO."],
  ["about.html", "about.astro", "About Us | New Leaf Hearing Care", "New Leaf Hearing Care is an audiology and hearing aid clinic with trusted audiologists providing professional hearing services in Arvada, CO, and Littleton, CO."],
  ["Arvada.html", "audiologist-hearing-aids-arvada-colorado.astro", "New Leaf Hearing Care | Audiologists and Hearing Aids in Arvada, CO", "New Leaf Hearing Care provides expert hearing care and hearing aids in Arvada, CO."],
  ["Littleton.html", "audiologist-hearing-aids-littleton-colorado.astro", "New Leaf Hearing Care | Audiologists and Hearing Aids in Littleton, CO", "New Leaf Hearing Care provides expert hearing care and hearing aids in Littleton, CO."],
  ["templates/contact.html", "contact-us.astro", "Contact Us | New Leaf Hearing Care", "New Leaf Hearing Care is an audiology and hearing aid clinic with trusted audiologists providing professional hearing services in Arvada, CO and Littleton, CO."],
  ["sitemap.html", "sitemap.astro", "Sitemap | New Leaf Hearing Care", "Sitemap for New Leaf Hearing Care."]
];

fs.cpSync(path.join(localRoot, "assets", "css"), path.join(stagingRoot, "src", "styles", "local"), { recursive: true });
fs.cpSync(path.join(projectRoot, "assets"), path.join(stagingRoot, "public", "assets"), { recursive: true });
for (const cssFile of walk(path.join(stagingRoot, "src", "styles", "local")).filter((file) => file.endsWith(".css"))) {
  const css = read(cssFile).replaceAll("../../../../assets/", "/assets/").replaceAll("../../../assets/", "/assets/");
  write(cssFile, css);
}

const templateHtml = read(path.join(localRoot, "templates", "internal.html"));
const bodyHtml = extractBetween(templateHtml, /<body\b/i, "</body>");
const header = extractTag(bodyHtml, "header", "site-header")?.outer || "";
const footer = extractTag(bodyHtml, "footer", "site-footer")?.outer || "";
const mobileCta = extractTag(bodyHtml, "section", "mobile-cta-section")?.outer || "";
const footerAndMobileCta = `${footer}\n${mobileCta}`.trim();
const scriptMatch = bodyHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
const scripts = scriptMatch ? scriptMatch[1] : "";

write(
  path.join(stagingRoot, "src", "components", "Header.astro"),
  normalizeAssetPaths(header).replaceAll('href="#"', 'href="/"')
);
write(
  path.join(stagingRoot, "src", "components", "Footer.astro"),
  normalizeAssetPaths(footerAndMobileCta).replaceAll('href="#"', 'href="/"')
);
write(
  path.join(stagingRoot, "src", "components", "SiteScripts.astro"),
  `<script is:inline>\n${normalizeAssetPaths(scripts)}\n${accordionAndTocScript()}\n</script>\n`
);

write(
  path.join(stagingRoot, "src", "layouts", "Base.astro"),
  `---\nimport "../styles/local/global.css";\nimport "../styles/local/layout.css";\nimport "../styles/local/components.css";\nimport "../styles/local/sections.css";\nimport "../styles/local/pages/home.css";\nimport "../styles/local/pages/about.css";\nimport "../styles/local/pages/internal.css";\nimport "../styles/local/pages/contact.css";\nimport "../styles/local/pages/member.css";\nimport "../styles/local/pages/blog.css";\nimport "../styles/local/pages/Arvada.css";\nimport "../styles/local/pages/Littleton.css";\nimport Preloader from "../components/Preloader.astro";\nimport Header from "../components/Header.astro";\nimport Footer from "../components/Footer.astro";\nimport SiteScripts from "../components/SiteScripts.astro";\n\nconst { title = "New Leaf Hearing Care", description = "", canonical } = Astro.props;\n---\n<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>{title}</title>\n    {description && <meta name="description" content={description} />}\n    {canonical && <link rel="canonical" href={canonical} />}\n    <link rel="icon" type="image/webp" href="/assets/new-leaf-hearing-care-favicon.webp" />\n    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Outfit:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet" />\n  </head>\n  <body>\n    <Preloader />\n    <Header />\n    <slot />\n    <Footer />\n    <SiteScripts />\n  </body>\n</html>\n`
);

write(
  path.join(stagingRoot, "src", "components", "PortableRichText.astro"),
  `---\nconst { value = [] } = Astro.props;\n\nconst slugify = (value) => String(value || "")\n  .toLowerCase()\n  .replace(/&/g, " and ")\n  .replace(/[^a-z0-9]+/g, "-")\n  .replace(/^-+|-+$/g, "");\n\nconst escapeHtml = (value) => String(value ?? "")\n  .replace(/&/g, "&amp;")\n  .replace(/</g, "&lt;")\n  .replace(/>/g, "&gt;")\n  .replace(/"/g, "&quot;");\n\nconst renderSpans = (children = [], markDefs = []) => children.map((span) => {\n  if (span._type !== "span") return "";\n  let text = escapeHtml(span.text || "");\n  for (const mark of span.marks || []) {\n    const def = markDefs.find((item) => item._key === mark);\n    if (def?._type === "link") text = '<a href=\"' + escapeHtml(def.href || "#") + '\">' + text + '</a>';\n    else if (mark === "strong") text = '<strong>' + text + '</strong>';\n    else if (mark === "em") text = '<em>' + text + '</em>';\n  }\n  return text;\n}).join("");\n\nconst html = [];\nlet list = null;\nconst closeList = () => {\n  if (list) {\n    html.push('</' + list + '>');\n    list = null;\n  }\n};\n\nfor (const block of value || []) {\n  if (block._type !== "block") continue;\n  const inner = renderSpans(block.children || [], block.markDefs || []);\n  if (block.listItem) {\n    const tag = block.listItem === "number" ? "ol" : "ul";\n    if (list !== tag) {\n      closeList();\n      list = tag;\n      html.push('<' + tag + '>');\n    }\n    html.push('<li>' + inner + '</li>');\n    continue;\n  }\n  closeList();\n  const style = block.style || "normal";\n  if (/^h[1-6]$/.test(style)) html.push('<' + style + ' id=\"' + slugify(inner.replace(/<[^>]+>/g, "")) + '\">' + inner + '</' + style + '>');\n  else if (style === "blockquote") html.push('<blockquote>' + inner + '</blockquote>');\n  else html.push('<p>' + inner + '</p>');\n}\ncloseList();\n---\n<Fragment set:html={html.join("\\n")} />\n`
);

write(
  path.join(stagingRoot, "src", "components", "EntryShell.astro"),
  `---\nimport PortableRichText from "./PortableRichText.astro";\nconst { shell = "", introContent = [], content = [] } = Astro.props;\nconst [beforeIntro = "", afterIntroRaw = ""] = shell.split("<!--EMDASH_INTRO_CONTENT-->");\nconst [between = "", afterContent = ""] = afterIntroRaw.split("<!--EMDASH_MAIN_CONTENT-->");\n---\n<Fragment set:html={beforeIntro} />\n<PortableRichText value={introContent} />\n<Fragment set:html={between} />\n<PortableRichText value={content} />\n<Fragment set:html={afterContent} />\n`
);

for (const [source, outFile, title, description] of staticPages) {
  const html = read(path.join(localRoot, source));
  const main = `<main>${normalizeAssetPaths(extractMainInner(html))}</main>`;
  const rawPath = `../content-shells/static/${outFile.replace(".astro", ".html")}?raw`;
  write(path.join(stagingRoot, "src", "content-shells", "static", outFile.replace(".astro", ".html")), main);
  write(
    path.join(stagingRoot, "src", "pages", outFile),
    `---\nimport Base from "../layouts/Base.astro";\nimport pageHtml from "${rawPath}";\nexport const cacheHint = 3600;\n---\n<Base title=${JSON.stringify(title)} description=${JSON.stringify(description)}>\n  <Fragment set:html={pageHtml} />\n</Base>\n`
  );
}

const content = {};
const shellsManifest = {};

for (const [collection, pages] of Object.entries(dynamicPages)) {
  content[collection] = [];
  shellsManifest[collection] = {};
  for (const item of pages) {
    const [fileName, route, teamTitle, imageFile] = item;
    const html = read(path.join(localRoot, fileName));
    const title = h1Title(html) || fileName.replace(/\.html$/i, "");
    const mainInner = normalizeAssetPaths(extractMainInner(html));
    const editableRegion =
      extractTag(mainInner, "article", "internal-article") ||
      extractTag(mainInner, "div", "internal-article");
    const editableInner = editableRegion?.inner || "";
    const { introHtml, contentHtml } = splitIntroContent(editableInner);
    const before = mainInner.slice(0, editableRegion?.innerStart || 0);
    const after = mainInner.slice(editableRegion?.innerEnd || 0);
    const shell = `<main>${before}<!--EMDASH_INTRO_CONTENT--><!--EMDASH_MAIN_CONTENT-->${after}</main>`;
    const shellFile = `${safeFile(route)}.html`;
    write(path.join(stagingRoot, "src", "content-shells", collection, shellFile), shell);
    shellsManifest[collection][route] = shellFile;
    const data = {
      page_title: title,
      page_slug: `/${route}`,
      meta_title: metaTitle(html) || title,
      meta_description: metaDescription(html),
      intro_content: htmlToPortableText(introHtml),
      content: htmlToPortableText(contentHtml)
    };
    if (collection === "team") {
      delete data.intro_content;
      data.title = teamTitle || "";
      data.featured_image = imageFile
        ? { provider: "external", id: safeFile(route), src: `/assets/${imageFile}`, alt: title, filename: imageFile }
        : null;
    }
    if (collection === "blog_posts") {
      data.displayed_author_name = "";
      data.displayed_publish_date = "";
      data.displayed_tags = "";
      data.featured_image = null;
    }
    content[collection].push({
      id: `${collection}-${safeFile(route)}`,
      slug: route,
      status: "published",
      data
    });
  }
}

write(path.join(stagingRoot, "src", "data", "shells.json"), JSON.stringify(shellsManifest, null, 2));

write(
  path.join(stagingRoot, "src", "pages", "[...slug].astro"),
  `---\nimport { getEmDashEntry } from "emdash";\nimport Base from "../layouts/Base.astro";\nimport EntryShell from "../components/EntryShell.astro";\nimport shells from "../data/shells.json";\n\nexport const prerender = false;\nexport const cacheHint = 3600;\n\nconst requestedSlug = Astro.params.slug || "";\nconst shellImports = import.meta.glob("../content-shells/**/*.html", { query: "?raw", import: "default" });\nconst collections = ["internal_pages", "hearing_aids", "team", "blog_posts"];\nlet entry;\nlet collection;\nlet shellFile;\n\nfor (const candidate of collections) {\n  const result = await getEmDashEntry(candidate, requestedSlug);\n  if (result.entry) {\n    entry = result.entry;\n    collection = candidate;\n    shellFile = shells[candidate]?.[requestedSlug];\n    break;\n  }\n}\n\nif (!entry || !collection || !shellFile) {\n  return Astro.redirect("/404", 302);\n}\n\nconst shellPath = \`../content-shells/\${collection}/\${shellFile}\`;\nconst loadShell = shellImports[shellPath];\nconst shell = loadShell ? await loadShell() : "";\nconst data = entry.data;\n---\n<Base title={data.meta_title || data.page_title} description={data.meta_description || ""}>\n  <EntryShell shell={shell} introContent={data.intro_content || []} content={data.content || []} />\n</Base>\n`
);

const field = (slug, label, type, extra = {}) => ({ slug, label, type, ...extra });
const sharedFields = [
  field("page_title", "Page Title", "string", { required: true, searchable: true }),
  field("page_slug", "Slug", "slug", { required: true }),
  field("meta_title", "Meta Title", "string"),
  field("meta_description", "Meta Description", "text"),
  field("intro_content", "Intro Content", "portableText", { searchable: true }),
  field("content", "Content", "portableText", { searchable: true })
];

const seed = {
  version: "1",
  meta: {
    name: "New Leaf Hearing Care",
    description: "Staging conversion from localized static HTML."
  },
  settings: {
    site_name: "New Leaf Hearing Care",
    site_description: "New Leaf Hearing Care is an audiology and hearing aid clinic in Colorado.",
    phone: "(303) 639-5323",
    book_url: "/contact-us"
  },
  collections: [
    { slug: "internal_pages", label: "Internal Pages", labelSingular: "Internal Page", supports: ["drafts", "revisions", "search", "seo"], urlPattern: "/{slug}", fields: sharedFields },
    { slug: "hearing_aids", label: "Hearing Aids", labelSingular: "Hearing Aid", supports: ["drafts", "revisions", "search", "seo"], urlPattern: "/{slug}", fields: sharedFields },
    { slug: "team", label: "Team", labelSingular: "Team Member", supports: ["drafts", "revisions", "search", "seo"], urlPattern: "/{slug}", fields: [
      field("page_title", "Page Title", "string", { required: true, searchable: true }),
      field("page_slug", "Slug", "slug", { required: true }),
      field("meta_title", "Meta Title", "string"),
      field("meta_description", "Meta Description", "text"),
      field("title", "Title", "string"),
      field("content", "Content", "portableText", { searchable: true }),
      field("featured_image", "Featured Image", "image")
    ] },
    { slug: "blog_posts", label: "Blog Posts", labelSingular: "Blog Post", supports: ["drafts", "revisions", "search", "seo"], urlPattern: "/blog/{slug}", fields: [
      field("page_title", "Page Title", "string", { required: true, searchable: true }),
      field("page_slug", "Slug", "slug", { required: true }),
      field("meta_title", "Meta Title", "string"),
      field("meta_description", "Meta Description", "text"),
      field("displayed_author_name", "Displayed Author Name", "string"),
      field("displayed_publish_date", "Displayed Publish Date", "string"),
      field("displayed_tags", "Displayed Tags", "string"),
      field("featured_image", "Featured Image", "image"),
      field("content", "Content", "portableText", { searchable: true })
    ] }
  ],
  taxonomies: [
    { name: "category", label: "Categories", labelSingular: "Category", hierarchical: true, collections: ["blog_posts"] },
    { name: "tag", label: "Tags", labelSingular: "Tag", hierarchical: false, collections: ["blog_posts"] }
  ],
  menus: [
    { name: "primary", label: "Primary Navigation", items: [
      { type: "custom", label: "About", url: "/about" },
      { type: "custom", label: "Services", url: "/audiology-services" },
      { type: "custom", label: "Hearing Aids", url: "/hearing-aid-services" },
      { type: "custom", label: "Resources", url: "/resources/faq" }
    ] }
  ],
  content
};

write(path.join(stagingRoot, "seed", "seed.json"), JSON.stringify(seed, null, 2));

function accordionAndTocScript() {
  return `
(() => {
  const articles = Array.from(document.querySelectorAll(".internal-article"));
  if (!articles.length) return;

  const slugify = (value) => String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const getNodesUntil = (startNode, stopSelector) => {
    const nodes = [];
    let node = startNode.nextElementSibling;
    while (node && !node.matches(stopSelector)) {
      nodes.push(node);
      node = node.nextElementSibling;
    }
    return nodes;
  };

  const createAccordion = (heading, contentNodes) => {
    const details = document.createElement("details");
    details.className = "internal-subaccordion internal-accordion";
    const summary = document.createElement("summary");
    const icon = document.createElement("span");
    icon.className = "internal-accordion__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "+";
    summary.append(heading);
    summary.append(icon);
    const content = document.createElement("div");
    content.className = "internal-accordion__content";
    contentNodes.forEach((node) => content.append(node));
    details.append(summary);
    details.append(content);
    return details;
  };

  const convertChildHeadings = (parentHeading, childSelector, nextParentSelector) => {
    const childHeadings = getNodesUntil(parentHeading, nextParentSelector)
      .filter((node) => node.matches(childSelector));
    if (childHeadings.length <= 1) return;
    const group = document.createElement("div");
    group.className = "internal-accordion-group";
    childHeadings.forEach((heading) => {
      const contentNodes = getNodesUntil(heading, childSelector + ", " + nextParentSelector);
      group.append(createAccordion(heading, contentNodes));
    });
    parentHeading.after(group);
  };

  articles.forEach((article) => {
    if (!article.querySelector(".internal-accordion-group")) {
      Array.from(article.querySelectorAll("h3")).forEach((heading) => {
        convertChildHeadings(heading, "h4", "h2, h3");
      });
      Array.from(article.querySelectorAll("h2")).forEach((heading) => {
        convertChildHeadings(heading, "h3", "h2");
      });
    }

    if (article.querySelector(".toc-container")) return;
    const headings = Array.from(article.querySelectorAll("h2, h3, h4"));
    if (headings.filter((heading) => heading.tagName === "H2").length < 2) return;
    const toc = document.createElement("div");
    toc.className = "toc-container";
    toc.innerHTML = '<details class="toc-accordion internal-accordion"><summary><span>Table of Contents</span><span class="toc-accordion__icon" aria-hidden="true">+</span></summary><nav class="toc-accordion__content" aria-label="Table of contents"></nav></details>';
    const nav = toc.querySelector("nav");
    headings.forEach((heading) => {
      if (!heading.id) heading.id = slugify(heading.textContent);
      const link = document.createElement("a");
      link.className = "toc-link toc-link--" + heading.tagName.toLowerCase();
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      nav.append(link);
    });
    const firstH2 = article.querySelector("h2");
    if (firstH2) article.insertBefore(toc, firstH2);
  });

  const animationDuration = 300;
  const animations = new WeakMap();

  const animateAccordion = (accordion, shouldOpen) => {
    const summary = accordion.querySelector("summary");
    if (!summary) return;
    const currentAnimation = animations.get(accordion);
    if (currentAnimation) currentAnimation.cancel();
    const startHeight = accordion.offsetHeight + "px";
    accordion.style.overflow = "hidden";
    if (shouldOpen) accordion.open = true;
    const endHeight = shouldOpen ? accordion.offsetHeight + "px" : summary.offsetHeight + "px";
    accordion.style.height = startHeight;
    const animation = accordion.animate(
      { height: [startHeight, endHeight] },
      { duration: animationDuration, easing: "ease" }
    );
    animations.set(accordion, animation);
    animation.onfinish = () => {
      if (!shouldOpen) accordion.open = false;
      accordion.style.height = "";
      accordion.style.overflow = "";
      animations.delete(accordion);
    };
    animation.oncancel = () => {
      animations.delete(accordion);
    };
  };

  Array.from(document.querySelectorAll(".internal-accordion")).forEach((accordion) => {
    const summary = accordion.querySelector("summary");
    if (!summary || summary.dataset.accordionBound === "true") return;
    summary.dataset.accordionBound = "true";
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const shouldOpen = !accordion.open;
      const group = accordion.closest(".internal-accordion-group");
      const groupAccordions = group ? Array.from(group.querySelectorAll(".internal-accordion")) : [accordion];
      groupAccordions.forEach((otherAccordion) => {
        if (otherAccordion !== accordion && otherAccordion.open) {
          animateAccordion(otherAccordion, false);
        }
      });
      animateAccordion(accordion, shouldOpen);
    });
  });
})();
`;
}

console.log("Generated New Leaf staging project from local HTML.");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
