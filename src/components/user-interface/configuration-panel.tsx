import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useProjectInit } from "../project-initialization/ProjectInitializationContext"

interface ConfigurationPanelProps {
  isExpanded: boolean
}

export function ConfigurationPanel({ isExpanded }: ConfigurationPanelProps) {
  const { state, updateProjectConfig, updateAIConfig, updateInfrastructureConfig } = useProjectInit()

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
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select value={state.aiProvider} onValueChange={(value) => updateAIConfig({ aiProvider: value as any })}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                <SelectItem value="google">Google (Gemini)</SelectItem>
                <SelectItem value="grok">X.AI (Grok)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input 
              value={state.projectName} 
              onChange={(e) => updateProjectConfig({ projectName: e.target.value })}
              placeholder="Enter project name" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-template">Project Template</Label>
            <Select value={state.templateId} onValueChange={(value) => updateProjectConfig({ templateId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vite-react-mongo">React + MongoDB + Prisma</SelectItem>
                <SelectItem value="vite-react-supabase">React + Supabase</SelectItem>
                <SelectItem value="nextjs-supabase">Next.js + Supabase</SelectItem>
                <SelectItem value="vite-react-planetscale">React + PlanetScale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="github-org">GitHub Organization/Username</Label>
            <Input 
              value={state.githubOrg}
              onChange={(e) => updateInfrastructureConfig({ githubOrg: e.target.value })}
              placeholder="Enter GitHub username" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mongodb-org">MongoDB Organization</Label>
            <Input 
              value={state.mongodbOrgId}
              onChange={(e) => updateInfrastructureConfig({ mongodbOrgId: e.target.value })}
              placeholder="Enter MongoDB org" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mongodb-project">MongoDB Project</Label>
            <Input 
              value={state.mongodbProjectId}
              onChange={(e) => updateInfrastructureConfig({ mongodbProjectId: e.target.value })}
              placeholder="CREATE_NEW or existing project ID" 
            />
          </div>
        </div>
      </Card>
    </div>
    </>
  )
}