import { useState } from "react"
import { 
  Paperclip, 
  Upload, 
  FileText, 
  Palette, 
  Cloud, 
  RotateCcw,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AttachmentDropdown() {
  const [isOpen, setIsOpen] = useState(false)

  const attachmentOptions = [
    { icon: Upload, label: "Upload a file", description: "Choose from device" },
    { icon: FileText, label: "Add text content", description: "Paste or type text" },
    { icon: Palette, label: "Draw a sketch", description: "Create a drawing" },
    { icon: Cloud, label: "Connect Google Drive", description: "Access files" },
    { icon: Cloud, label: "Connect Microsoft OneDrive", description: "Access files" },
  ]

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 border rounded-full">
          <Paperclip className="h-4 w-4" />
          <span className="sr-only">Attach files</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-2xl">
        {attachmentOptions.map((option, index) => (
          <DropdownMenuItem key={index} className="flex items-center gap-3 p-3 cursor-pointer rounded-xl">
            <option.icon className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-pointer">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm font-medium">Recent</div>
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}