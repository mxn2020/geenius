import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface ConfigurationPanelProps {
  isExpanded: boolean
}

export function ConfigurationPanel({ isExpanded }: ConfigurationPanelProps) {
  return (
    <>
      {/* Wall/mask element */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 max-w-3xl w-full h-60 bg-white dark:bg-black z-40"></div>
      
      {/* Configuration panel */}
      <div 
        className={`absolute top-0 left-1/2 transform -translate-x-1/2 max-w-2xl w-full z-0 transition-all duration-500 ease-out ${
          isExpanded ? 'translate-y-0' : '-translate-y-full opacity-0'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          transitionDuration: '500ms, 0ms',
          transitionTimingFunction: 'ease-out, ease-out',
          transitionDelay: isExpanded ? '0ms, 0ms' : '0ms, 500ms'
        }}
      >
        <Card className="pt-6 pb-4 px-4 bg-muted/30 border-muted-foreground/20 rounded-t-none rounded-b-lg border-t-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <Label htmlFor="agent-architecture">Agent Architecture</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select architecture" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="react">React Agent</SelectItem>
                <SelectItem value="autonomous">Autonomous Agent</SelectItem>
                <SelectItem value="workflow">Workflow Agent</SelectItem>
                <SelectItem value="rag">RAG Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input placeholder="Enter project name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-template">Project Template</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nextjs">Next.js</SelectItem>
                <SelectItem value="react">React</SelectItem>
                <SelectItem value="vue">Vue.js</SelectItem>
                <SelectItem value="svelte">Svelte</SelectItem>
                <SelectItem value="vanilla">Vanilla JS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="github-org">GitHub Organization/Username</Label>
            <Input placeholder="Enter GitHub username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mongodb-org">MongoDB Organization</Label>
            <Input placeholder="Enter MongoDB org" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mongodb-project">MongoDB Project</Label>
            <Input placeholder="Enter MongoDB project" />
          </div>
        </div>
      </Card>
    </div>
    </>
  )
}