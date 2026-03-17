import { getContracts } from "@/lib/mock/data"

export function generateStaticParams() {
  return getContracts().map((c) => ({ id: c.id }))
}

export default function WorkDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
