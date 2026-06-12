import { getEmDashCollection } from "emdash";

export type TeamMember = {
  href: string;
  name: string;
  jobTitle: string;
  image: {
    src: string;
    alt: string;
  };
};

const normalizeSlug = (entry: any) => {
  const raw = entry.slug || entry.data?.page_slug || entry.data?.slug || entry.id || "";
  return String(raw).replace(/^\/+|\/+$/g, "");
};

const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const imageFor = (entry: any, name: string) => {
  const image = entry.data?.featured_image;
  if (!image) {
    return {
      src: "/assets/new-leaf-hearing-care-logo.webp",
      alt: name
    };
  }

  if (typeof image === "string") {
    return {
      src: image,
      alt: name
    };
  }

  const storageKey = image.meta?.storageKey || image.storageKey || image.storage_key;

  return {
    src:
      image.src ||
      image.url ||
      (image.provider === "local" && storageKey ? `/_emdash/api/media/file/${storageKey}` : "") ||
      (image.filename ? `/assets/${image.filename}` : "/assets/new-leaf-hearing-care-logo.webp"),
    alt: image.alt || name
  };
};

const teamMemberFromEntry = (entry: any): TeamMember | null => {
  const name = entry.data?.page_title || entry.data?.title || entry.data?.name || "";
  if (!name) return null;

  const title = entry.data?.title || "";
  const jobTitle = entry.data?.job_title || (title && title !== name ? title : "");
  const slug = normalizeSlug(entry);
  const image = imageFor(entry, name);

  return {
    href: `/${slug}/`,
    name,
    jobTitle,
    image
  };
};

export const getPublishedTeamMembers = async (): Promise<TeamMember[]> => {
  const { entries = [] } = await getEmDashCollection("team", {
    status: "published",
    orderBy: { created_at: "asc" }
  });

  return entries.map(teamMemberFromEntry).filter(Boolean) as TeamMember[];
};

export const renderTeamLinks = (members: TeamMember[]) =>
  members
    .map((member) => `<a href="${escapeHtml(member.href)}">${escapeHtml(member.name)}</a>`)
    .join("");

export const renderTeamSection = (members: TeamMember[]) => {
  if (!members.length) return "";

  const hasCarousel = members.length > 4;
  const hasMobileCarousel = members.length > 1;
  const cards = members
    .map(
      (member) => `<a class="team-card" href="${escapeHtml(member.href)}">
              <img src="${escapeHtml(member.image.src)}" alt="${escapeHtml(member.image.alt)}" loading="lazy" decoding="async" />
              <div class="team-card__label">
                <h3>${escapeHtml(member.name)}</h3>
                ${member.jobTitle ? `<p>${escapeHtml(member.jobTitle)}</p>` : ""}
              </div>
            </a>`
    )
    .join("");

  const controls = hasCarousel || hasMobileCarousel
    ? `<div class="team-controls" aria-label="Team carousel controls">
          <button class="team-nav" type="button" aria-label="Previous team member" data-team-prev>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </button>
          <button class="team-nav" type="button" aria-label="Next team member" data-team-next>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12h14m0 0-6-6m6 6-6 6" />
            </svg>
          </button>
        </div>`
    : "";

  return `<section class="team-section new-leaf-texture-overlay${hasCarousel ? " has-carousel" : ""}${hasMobileCarousel ? " has-mobile-carousel" : ""}" aria-labelledby="team-heading">
        <div class="team-section__inner heading-group">
          <p class="eyebrow eyebrow--light">Serving Arvada, CO and Littleton, CO</p>
          <h2 id="team-heading" class="section-title section-title--light">Meet The Team</h2>
        </div>
        <div class="team-carousel">
          <div class="team-track" aria-label="Team members">
            ${cards}
          </div>
        </div>
        ${controls}
      </section>`;
};

export const replaceTeamSections = (html: string, members: TeamMember[]) =>
  html.replace(/<section class="team-section[\s\S]*?<\/section>/g, renderTeamSection(members));
