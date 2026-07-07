function isSectionHeading(paragraph: string) {
  const trimmed = paragraph.trim()
  if (trimmed.length > 80) return false
  if (/[:?]$/.test(trimmed)) return true
  if (/^(responsibilities|requirements|qualifications|preferred qualifications|who we are|what we do|benefits|about)/i.test(trimmed)) {
    return true
  }
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
}

export default function JobDescription({ description }: { description: string }) {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length <= 1) {
    const lines = description
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length > 1) {
      return (
        <div className="space-y-4 text-[15px] leading-7 text-foreground/90">
          {lines.map((line, index) =>
            isSectionHeading(line) ? (
              <h3 key={index} className="pt-2 text-base font-semibold text-primary">
                {line}
              </h3>
            ) : (
              <p key={index}>{line}</p>
            )
          )}
        </div>
      )
    }
  }

  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground/90">
      {paragraphs.map((paragraph, index) =>
        isSectionHeading(paragraph) ? (
          <h3 key={index} className="pt-2 text-base font-semibold text-primary">
            {paragraph}
          </h3>
        ) : (
          <p key={index}>{paragraph}</p>
        )
      )}
    </div>
  )
}
