// src/DevelopmentTab.tsx

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AppHooks } from './app-types';

interface DevelopmentTabProps extends AppHooks {}

const DevelopmentTab: React.FC<DevelopmentTabProps> = ({
  loading,
  setLoading,
  setLoadingMessage
}) => {
  const handleDevelopSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage('Starting development session...');

    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch('/api/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        setLoadingMessage('Development session started!');
        setTimeout(() => setLoading(false), 2000);
      } else {
        throw new Error(result.error || 'Failed to start development');
      }
    } catch (error) {
      console.error('Development failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadingMessage(`Error: ${errorMessage}`);
      setTimeout(() => setLoading(false), 3000);
    }
  };

  return (
    <Card className="shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Development Session</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDevelopSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="featureName">Feature Branch Name</Label>
            <Input
              type="text"
              name="featureName"
              placeholder="feature/ai-development"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="complexity">Task Complexity</Label>
            <Select name="complexity" required defaultValue="medium">
              <SelectTrigger>
                <SelectValue placeholder="Select task complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">🟢 Simple - Bug fixes, small updates</SelectItem>
                <SelectItem value="medium">🟡 Medium - New features, refactoring</SelectItem>
                <SelectItem value="complex">🔴 Complex - Architecture changes, integrations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Task Priority</Label>
            <Select name="priority" required defaultValue="medium">
              <SelectTrigger>
                <SelectValue placeholder="Select task priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔥 Urgent - Critical fixes</SelectItem>
                <SelectItem value="high">🔴 High - Important features</SelectItem>
                <SelectItem value="medium">🟡 Medium - Regular development</SelectItem>
                <SelectItem value="low">🟢 Low - Nice to have</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredMode">Agent Mode</Label>
            <Select name="preferredMode" required defaultValue='single'>
              <SelectTrigger>
                <SelectValue placeholder="Select agent mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">🎯 Single Agent - Fast execution</SelectItem>
                <SelectItem value="orchestrated">👥 Multi-Agent Team - Comprehensive approach</SelectItem>
                <SelectItem value="auto">🤖 Auto-select - Let AI decide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskDescription">Task Description</Label>
            <Textarea
              name="taskDescription"
              rows={12}
              placeholder="# Feature Requirements

## Description
Describe your feature here...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
- Implementation details
- Performance considerations
- Security requirements

## Testing Requirements
- Unit tests
- Integration tests
- E2E tests if applicable"
              className="font-mono text-sm"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            🚀 Start Development
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DevelopmentTab;