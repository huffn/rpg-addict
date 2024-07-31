import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { simplifySlug } from "../util/path"

const NavBar: QuartzComponent = ({ fileData, allFiles, displayClass, cfg }: QuartzComponentProps) => {
  const currentPage = simplifySlug(fileData.slug!)
  const allFolderPages = allFiles.filter((file) => {
    const slug = simplifySlug(file.slug!)
    return slug.endsWith('/') && slug.length > 1
  }).map(folderPage => {
    const slug = simplifySlug(folderPage.slug!)
    return {
      slug,
      title: folderPage.frontmatter?.title,
      active: currentPage.startsWith(slug)
    }
  })

  return (
    <nav class={classNames(displayClass, "sidebar-nav")}>
        <a class={currentPage == '/' ? "sidebar-nav-item active" : "sidebar-nav-item"} href="/">Home</a>
        {allFolderPages.map(page => <a class={page.active ? "sidebar-nav-item active" : "sidebar-nav-item"} href={`/${page.slug}`}>{page.title}</a>)}
        {cfg?.currentlyPlaying && cfg?.currentlyPlayingLink ? <span class="sidebar-nav-item desktop-only">Currently playing <a href={cfg.currentlyPlayingLink} rel="noopener" target="_blank">{cfg.currentlyPlaying}</a></span> : ''}
      </nav>
  )
}

NavBar.css = `
.sidebar-nav {
  padding: 1rem;
  overflow-y: scroll;
  scrollbar-width: none;
}
.sidebar-nav-item {
  display: block;
  font-weight: 500;
  &.active {
    font-weight: 700;
  }
}

a.sidebar-nav-item:focus,a.sidebar-nav-item:hover {
  text-decoration: underline;
}
`

export default (() => NavBar) satisfies QuartzComponentConstructor
