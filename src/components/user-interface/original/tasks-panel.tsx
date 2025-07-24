import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, RotateCcw, X } from "lucide-react"

interface TasksPanelProps {
  isExpanded: boolean
  onClose: () => void
  onItemSelect: (item: any) => void
  selectedItem?: any
}

// Mock data for tasks
const mockTasks = [
  {
    id: "1",
    name: "Fix navigation bug",
    description: "Mobile navigation menu not closing on route change",
    tags: ["bug", "mobile", "navigation", "urgent"],
    priority: "high",
    status: "open",
    assignee: "John Doe"
  },
  {
    id: "2",
    name: "Add dark mode toggle",
    description: "Implement system-wide dark mode with user preference storage",
    tags: ["feature", "ui", "dark-mode", "enhancement"],
    priority: "medium",
    status: "in-progress",
    assignee: "Jane Smith"
  },
  {
    id: "3",
    name: "Optimize image loading",
    description: "Implement lazy loading and WebP format for better performance",
    tags: ["performance", "images", "optimization"],
    priority: "medium",
    status: "open",
    assignee: "Mike Johnson"
  },
  {
    id: "4",
    name: "Update documentation",
    description: "Update API documentation with latest endpoint changes",
    tags: ["documentation", "api", "maintenance"],
    priority: "low",
    status: "completed",
    assignee: "Sarah Wilson"
  },
  {
    id: "5",
    name: "Add unit tests",
    description: "Write comprehensive unit tests for user authentication module",
    tags: ["testing", "authentication", "quality"],
    priority: "high",
    status: "open",
    assignee: "Alex Brown"
  }
]

export function TasksPanel({ 
  isExpanded, 
  onClose, 
  onItemSelect, 
  selectedItem 
}: TasksPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])

  // Get all unique tags for filters
  const allTags = Array.from(new Set(mockTasks.flatMap(item => item.tags || [])))

  // Filter items based on search and filters
  const filteredItems = mockTasks.filter(item => {
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
      
      {/* Tasks panel */}
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
            <h3 className="font-semibold text-lg">Tasks</h3>
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
              placeholder="Search tasks..."
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
                <p>No tasks found</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}