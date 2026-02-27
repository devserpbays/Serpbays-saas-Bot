'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Rocket, CheckCircle2, Circle, Play, Loader2 } from 'lucide-react';

interface OnboardingChecklistProps {
  companyName: string;
  companyDescription: string;
  keywords: string[];
  enabledPlatforms: string[];
  socialAccounts: Array<{ platform: string }>;
  totalPosts: number;
  pipelineRunning: boolean;
  onOpenSettings: (tab: string) => void;
  onRunPipeline: () => void;
}

interface Step {
  label: string;
  description: string;
  complete: boolean;
  action: () => void;
  actionLabel: string;
  disabled?: boolean;
}

export default function OnboardingChecklist({
  companyName,
  companyDescription,
  keywords,
  enabledPlatforms,
  socialAccounts,
  totalPosts,
  pipelineRunning,
  onOpenSettings,
  onRunPipeline,
}: OnboardingChecklistProps) {
  const hasConnectedAccount = socialAccounts.some((a) =>
    enabledPlatforms.includes(a.platform)
  );

  const steps: Step[] = [
    {
      label: 'Company Info',
      description: 'Add your company name and description so the AI knows what you do.',
      complete: !!(companyName?.trim() && companyDescription?.trim()),
      action: () => onOpenSettings('general'),
      actionLabel: 'Edit Info',
    },
    {
      label: 'Add Keywords',
      description: 'Add keywords to monitor so the pipeline can find relevant posts.',
      complete: keywords.length > 0,
      action: () => onOpenSettings('keywords'),
      actionLabel: 'Add Keywords',
    },
    {
      label: 'Connect a Platform',
      description: 'Connect at least one social account with cookies for an enabled platform.',
      complete: hasConnectedAccount,
      action: () => onOpenSettings('platforms'),
      actionLabel: 'Connect Account',
    },
    {
      label: 'Run First Job',
      description: 'Run the full pipeline to scrape, evaluate, and generate your first replies.',
      complete: totalPosts > 0,
      action: onRunPipeline,
      actionLabel: 'Start Job',
      disabled: !(companyName?.trim() && companyDescription?.trim()) || keywords.length === 0 || !hasConnectedAccount,
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Get Started</h2>
          </div>
          <Badge variant="secondary">{completedCount} of {steps.length} complete</Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.complete ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.label}
                </p>
                {!step.complete && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
              {!step.complete && (
                <Button
                  size="sm"
                  variant={step.disabled ? 'outline' : 'default'}
                  disabled={step.disabled || pipelineRunning}
                  onClick={step.action}
                >
                  {step.label === 'Run First Job' && pipelineRunning ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running...</>
                  ) : step.label === 'Run First Job' ? (
                    <><Play className="w-3.5 h-3.5" />{step.actionLabel}</>
                  ) : (
                    step.actionLabel
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
