interface SectionHeadingProps {
  num: string
  eyebrow: string
  title: string
}

export function SectionHeading({ num, eyebrow, title }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div className="section-heading__num">{num}</div>
      <div className="section-heading__title">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  )
}
