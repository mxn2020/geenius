import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"
import { Menu, Plus } from "lucide-react"

export function Header() {
  return (
<header className="relative border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle menu</span>
          </Button>
          <div className="hidden md:flex items-center gap-2 text-lg font-semibold">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-primary-foreground rounded-full relative">
                <div className="absolute inset-0 border border-primary rounded-full transform rotate-45"></div>
              </div>
            </div>
            Geenius
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Plus className="h-4 w-4" />
            <span className="sr-only">New chat</span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}