import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, RotateCcw, X } from "lucide-react"

interface TemplatesPanelProps {
  isExpanded: boolean
  onClose: () => void
  onItemSelect: (item: any) => void
  selectedItem?: any
}

// Mock data for templates
const mockTemplates = [
  {
    id: "1",
    name: "React Dashboard",
    description: "Complete dashboard template with charts and tables",
    tags: ["react", "typescript", "dashboard", "charts"],
    category: "dashboard",
    downloads: 1240
  },
  {
    id: "2",
    name: "Landing Page",
    description: "Modern landing page with hero section and pricing",
    tags: ["nextjs", "tailwind", "landing", "marketing"],
    category: "marketing",
    downloads: 890
  },
  {
    id: "3",
    name: "E-commerce Store",
    description: "Full e-commerce template with cart and checkout",
    tags: ["react", "stripe", "ecommerce", "shopping"],
    category: "ecommerce",
    downloads: 2100
  },
  {
    id: "4",
    name: "Blog Template",
    description: "Clean blog template with markdown support",
    tags: ["gatsby", "markdown", "blog", "cms"],
    category: "blog",
    downloads: 650
  },
  {
    id: "5",
    name: "Portfolio Site",
    description: "Professional portfolio template for developers",
    tags: ["vue", "portfolio", "showcase", "responsive"],
    category: "portfolio",
    downloads: 420
  }
]

export function TemplatesPanel({ 
  isExpanded, 
  onClose, 
  onItemSelect, 
  selectedItem 
}: TemplatesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])

  // Get all unique tags for filters
  const allTags = Array.from(new Set(mockTemplates.flatMap(item => item.tags || [])))

  // Filter items based on search and filters
  const filteredItems = mockTemplates.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilters = selectedFilters.length === 0 || 
                          selectedFilters.some(filter => item.tags?.includes(filter))
    return matchesSearch && matchesFilters
  })

  const toggleFilter = (tag: string) => {
    setSelectedFilters(prev => 
      prev.includes(tag) 
        ? prev.filter(f => f !== tag)
        : [...prev, tag]
    )
  }

  const resetFilters = () => {
    setSearchQuery("")
    setSelectedFilters([])
  }

  return (
    <>
      {/* Wall/mask element */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 max-w-3xl w-full h-60 bg-white dark:bg-black z-50"></div>
      
      {/* Templates panel */}
      <div 
        className={`absolute top-0 left-1/2 transform -translate-x-1/2 max-w-2xl w-full z-0 transition-all duration-500 ease-out ${
          isExpanded ? 'translate-y-0' : '-translate-y-full opacity-0'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          transitionDuration: '500ms, 500ms',
          transitionTimingFunction: 'ease-out, ease-out',
          transitionDelay: isExpanded ? '0ms, 0ms' : '0ms, 250ms'
        }}
      >
        <Card className="pt-6 pb-4 px-4 bg-muted/30 border-muted-foreground/20 rounded-t-none rounded-b-lg border-t-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Templates</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close panel</span>
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedFilters.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleFilter(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Items List */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredItems.map(item => (
              <Card
                key={item.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedItem?.id === item.id ? 'bg-muted ring-2 ring-primary' : ''
                }`}
                onClick={() => onItemSelect(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    {item.tags && (
                      <div className="flex gap-1 mt-2">
                        {item.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No templates found</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}