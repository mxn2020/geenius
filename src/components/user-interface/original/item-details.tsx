import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Play, Copy } from "lucide-react"

interface ItemDetailsProps {
  item: any
  isVisible: boolean
  onClose: () => void
  onUse: (item: any) => void
  type: 'projects' | 'templates' | 'tasks'
}

export function ItemDetails({ 
  item, 
  isVisible, 
  onClose, 
  onUse, 
  type 
}: ItemDetailsProps) {
  if (!isVisible || !item) return null

  const getTypeSpecificContent = () => {
    switch (type) {
      case 'projects':
        return (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <p className="text-sm">{item.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Last Modified</label>
                <p className="text-sm">{item.lastModified}</p>
              </div>
            </div>
          </>
        )
      case 'templates':
        return (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="text-sm capitalize">{item.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Downloads</label>
                <p className="text-sm">{item.downloads?.toLocaleString()}</p>
              </div>
            </div>
          </>
        )
      case 'tasks':
        return (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <Badge 
                  variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {item.priority}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <p className="text-sm capitalize">{item.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Assignee</label>
                <p className="text-sm">{item.assignee}</p>
              </div>
            </div>
          </>
        )
      default:
        return null
    }
  }

  const getActionLabel = () => {
    switch (type) {
      case 'projects':
        return 'Open Project'
      case 'templates':
        return 'Use Template'
      case 'tasks':
        return 'Assign Task'
      default:
        return 'Use Item'
    }
  }

  return (
    <>
      {/* Wall/mask element */}
      <div className="absolute bottom-6 left-full transform translate-x-4 max-w-xs w-full h-80 bg-white dark:bg-black z-50"></div>
      
      {/* Details panel */}
      <div className="absolute left-full top-4 transform translate-x-4 w-80 z-0 transition-transform duration-500 ease-out">
        <Card className="h-[400px] bg-muted/30 border-muted-foreground/20 rounded-lg shadow-lg">
        <div className="p-4 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex-shrink-0 ml-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close details</span>
            </Button>
          </div>

          {/* Tags */}
          {item.tags && (
            <div className="mb-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Type-specific content */}
          <div className="mb-6">
            {getTypeSpecificContent()}
          </div>

          {/* Actions */}
          <div className="mt-auto space-y-2">
            <Button 
              onClick={() => onUse(item)} 
              className="w-full gap-2"
            >
              <Play className="h-4 w-4" />
              {getActionLabel()}
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(item, null, 2))
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Details
            </Button>
          </div>
        </div>
        </Card>
      </div>
    </>
  )
}