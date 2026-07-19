import { Search } from "lucide-react"

/**
 * 목록 검색 UI (3메뉴 공통). PageHeader 우측 슬롯에 배치해 위치·형태를 통일한다.
 * Enter 또는 검색 버튼으로 onSearch 호출.
 */
export default function ListSearch({
  value,
  onChange,
  onSearch,
  placeholder = "검사명, 파일명으로 검색",
}: {
  value: string
  onChange: (v: string) => void
  onSearch: () => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSearch() }}
        placeholder={placeholder}
        className="w-56 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
      />
      <button
        onClick={onSearch}
        className="px-4 py-2 bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
      >
        <Search className="w-4 h-4" />
        검색
      </button>
    </div>
  )
}
