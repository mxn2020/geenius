import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useProjectInit } from "../project-initialization/ProjectInitializationContext"
import { useAppState } from "../../app-hooks"

interface ConfigurationPanelProps {
  isExpanded: boolean
}

export function ConfigurationPanel({ isExpanded }: ConfigurationPanelProps) {
  const { state, updateProjectConfig, updateAIConfig, updateInfrastructureConfig } = useProjectInit()
  const {
    templates,
    githubAccounts,
    mongodbData,
    selectedOrg,
    selectedProject,
    selectedGithubAccount,
    handleOrgChange,
    getSelectedOrgProjects
  } = useAppState()

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
                <SelectValue placeholder={templates.length === 0 ? "Loading templates..." : "Select project template"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="github-org">GitHub Organization/Username</Label>
            {githubAccounts.loading ? (
              <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading GitHub accounts...
              </div>
            ) : githubAccounts.available && githubAccounts.accounts.length > 0 ? (
              <Select
                value={state.githubOrg}
                onValueChange={(value) => updateInfrastructureConfig({ githubOrg: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GitHub account" />
                </SelectTrigger>
                <SelectContent>
                  {githubAccounts.accounts.map(account => (
                    <SelectItem key={account.login} value={account.login}>
                      {account.login} ({account.type === 'user' ? '👤 Personal' : '🏢 Organization'})
                      {account.description && ` - ${account.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                value={state.githubOrg}
                onChange={(e) => updateInfrastructureConfig({ githubOrg: e.target.value })}
                placeholder="Enter GitHub username or organization"
              />
            )}
            {!githubAccounts.available && !githubAccounts.loading && (
              <Alert>
                <AlertDescription>
                  ⚠️ GitHub token not configured - manual input required
                </AlertDescription>
              </Alert>
            )}
          </div>
          {mongodbData.available && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mongodb-org">MongoDB Organization</Label>
                <Select
                  value={state.mongodbOrgId}
                  onValueChange={(value) => {
                    updateInfrastructureConfig({ mongodbOrgId: value })
                    handleOrgChange(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select MongoDB organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {mongodbData.organizations.map(orgData => (
                      <SelectItem key={orgData.organization.id} value={orgData.organization.id}>
                        {orgData.organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {state.mongodbOrgId && (
                <div className="space-y-2">
                  <Label htmlFor="mongodb-project">MongoDB Project</Label>
                  <Select
                    value={state.mongodbProjectId}
                    onValueChange={(value) => updateInfrastructureConfig({ mongodbProjectId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select MongoDB project" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.projectName && (
                        <SelectItem value="CREATE_NEW">
                          🆕 Create new project: "{state.projectName}"
                        </SelectItem>
                      )}
                      {getSelectedOrgProjects().map(project => {
                        const hasExistingClusters = project.clusters && project.clusters.length > 0;
                        return (
                          <SelectItem 
                            key={project.id} 
                            value={project.id}
                            disabled={hasExistingClusters}
                            className={hasExistingClusters ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            {project.name} {hasExistingClusters && `(${project.clusters.length} cluster${project.clusters.length > 1 ? 's' : ''})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
    </>
  )
}