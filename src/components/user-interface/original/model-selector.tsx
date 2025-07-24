import { useState } from "react"
import * as React from "react"
import { ChevronDown, ChevronRight, Settings, MoreHorizontal, Brain, Zap, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const providers = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Best for coding and technical tasks",
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
    ]
  },
  {
    id: "openai",
    name: "OpenAI (GPT)",
    description: "Most versatile, great for general development",
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o4-mini",
      "o3-mini",
      "o3",
    ]
  },
  {
    id: "google",
    name: "Google (Gemini)",
    description: "Creative problem solving and analysis",
    models: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ]
  },
  {
    id: "grok",
    name: "X.AI (Grok)",
    description: "Fast responses with unique perspectives",
    models: [
      "grok-4-0709",
      "grok-3",
      "grok-3-mini",
      "grok-3-fast",
      "grok-3-mini-fast"
    ]
  }
]

// Featured models for the main section
const featuredModels = [
  { name: "Claude Sonnet 4", provider: "Anthropic", model: "claude-sonnet-4-20250514", icon: Brain },
  { name: "GPT 4o", provider: "OpenAI", model: "gpt-4.1", icon: Zap },
  { name: "Grok 4", provider: "xAi", model: "grok-4-0709", icon: Search },
  { name: "Gemini 2.5 Pro", provider: "Google", model: "gemini-2.5-pro", icon: Sparkles },
]

// Provider icons mapping
const providerIcons = {
  "anthropic": Brain,
  "openai": Zap,
  "google": Sparkles,
  "grok": Search,
}

export function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState("Claude Sonnet 4")
  const [isOpen, setIsOpen] = useState(false)
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false)

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName)
    setIsOpen(false)
  }

  const formatModelName = (model: string) => {
    return model
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/20250514/g, '')
      .replace(/0709/g, '')
      .trim()
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-3 gap-2 text-sm font-medium">
          {selectedModel}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {/* Featured Models */}
        {featuredModels.map((model, index) => (
          <DropdownMenuItem 
            key={index} 
            className="flex items-center justify-between p-3 cursor-pointer"
            onClick={() => handleModelSelect(model.name)}
          >
            <model.icon className="h-4 w-4 text-muted-foreground mr-3" />
            <div className="flex-1">
              <div className="text-sm font-medium">{model.name}</div>
              <div className="text-xs text-muted-foreground">{model.provider}</div>
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* More Models Sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-3 p-3 cursor-pointer">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">More Models</div>
              <div className="text-xs text-muted-foreground">All available models</div>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80">
            <div className="max-h-80 overflow-y-auto">
            {/* All Providers and Models */}
            {providers.map((provider, providerIndex) => (
              <div key={provider.id}>
                <div className="px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    {React.createElement(providerIcons[provider.id as keyof typeof providerIcons], { 
                      className: "h-3 w-3 text-muted-foreground" 
                    })}
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {provider.name}
                  </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {provider.description}
                  </div>
                </div>
                {provider.models.slice(0, 6).map((model, modelIndex) => (
                  <DropdownMenuItem 
                    key={`${provider.id}-${modelIndex}`}
                    className="flex items-center justify-between p-3 cursor-pointer pl-6"
                    onClick={() => handleModelSelect(formatModelName(model))}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{formatModelName(model)}</div>
                      <div className="text-xs text-muted-foreground">{model}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
                {providerIndex < providers.length - 1 && <DropdownMenuSeparator />}
              </div>
            ))}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        
        {/* Custom Instructions */}
        <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-pointer">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm font-medium">Custom Instructions</div>
            <div className="text-xs text-muted-foreground">Not set</div>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            Customize
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}