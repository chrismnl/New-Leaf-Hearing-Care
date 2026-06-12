import { getEmDashCollection } from "emdash";

type SidebarBlogLink = {
  href: string;
  title: string;
};

const normalizeBlogSlug = (entry: any) => {
  const raw = entry.slug || entry.data?.slug || entry.data?.page_slug || entry.id || "";
  return String(raw).replace(/^\/+|\/+$/g, "").replace(/^blog\//, "");
};

const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const getSidebarBlogLinks = async (): Promise<SidebarBlogLink[]> => {
  const { entries = [] } = await getEmDashCollection("blog_posts", {
    status: "published",
    orderBy: { published_at: "desc" }
  });

  return entries.map((entry: any) => ({
    href: `/${normalizeBlogSlug(entry)}/`,
    title: entry.data?.title || entry.data?.page_title || entry.data?.meta_title || "Blog Post"
  }));
};

export const renderSidebarBlogLinks = (links: SidebarBlogLink[]) =>
  links.map((post) => `<a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a>`).join("");
