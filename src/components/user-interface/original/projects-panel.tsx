import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, RotateCcw, X } from "lucide-react"

interface ProjectsPanelProps {
  isExpanded: boolean
  onClose: () => void
  onItemSelect: (item: any) => void
  selectedItem?: any
}

// Mock data for projects
const mockProjects = [
  {
    id: "1",
    name: "E-commerce Dashboard",
    description: "Modern React dashboard for managing online stores",
    tags: ["react", "typescript", "dashboard", "ecommerce"],
    status: "active",
    lastModified: "2 days ago"
  },
  {
    id: "2", 
    name: "Blog Platform",
    description: "Full-stack blog with markdown support and comments",
    tags: ["nextjs", "prisma", "blog", "markdown"],
    status: "completed",
    lastModified: "1 week ago"
  },
  {
    id: "3",
    name: "Task Manager",
    description: "Collaborative task management with real-time updates",
    tags: ["vue", "websockets", "productivity", "collaboration"],
    status: "in-progress",
    lastModified: "5 hours ago"
  },
  {
    id: "4",
    name: "AI Chat Bot",
    description: "Intelligent chatbot with natural language processing",
    tags: ["python", "ai", "nlp", "fastapi"],
    status: "planning",
    lastModified: "3 days ago"
  }
]

export function ProjectsPanel({ 
  isExpanded, 
  onClose, 
  onItemSelect, 
  selectedItem 
}: ProjectsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])

  // Get all unique tags for filters
  const allTags = Array.from(new Set(mockProjects.flatMap(item => item.tags || [])))

  // Filter items based on search and filters
  const filteredItems = mockProjects.filter(item => {
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
      
      {/* Projects panel */}
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
            <h3 className="font-semibold text-lg">Projects</h3>
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
              placeholder="Search projects..."
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
          <div className="max-h-72 overflow-y-auto space-y-2">
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
                <p>No projects found</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}