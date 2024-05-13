import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { i18n } from "../i18n"

export default (() => {
  const Footer: QuartzComponent = ({ fileData, displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const baseDir = pathToRoot(fileData.slug!)
    return (
      <footer class={`${displayClass ?? ""}`}>
        <hr />
        <p>
          {i18n(cfg.locale).components.footer.copyright}
          {" "}© {year}{" "}
          <a href={baseDir}>{cfg.pageTitle}</a>
          {". "}
          {i18n(cfg.locale).components.footer.allRights}
        </p>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
