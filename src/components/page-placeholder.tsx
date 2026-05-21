type PagePlaceholderProps = {
  title: string
  description?: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {description ?? "This page is a placeholder. Content coming soon."}
      </p>
    </div>
  )
}
