import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { simplifySlug } from "../util/path"

const NavBar: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
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
    <nav class="sidebar-nav">
        <a class={currentPage == '/' ? "sidebar-nav-item active" : "sidebar-nav-item"} href="/">Home</a>
        {allFolderPages.map(page => <a class={page.active ? "sidebar-nav-item active" : "sidebar-nav-item"} href={`/${page.slug}`}>{page.title}</a>)}
        <span class="sidebar-nav-item desktop-only">Currently playing <a href="https://cityofmist.co" rel="noopener" target="_blank">City of Mist</a></span>
      </nav>
  )
}

NavBar.css = `
.sidebar-nav {
  padding: 1rem;
  overflow-y: scroll;
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
