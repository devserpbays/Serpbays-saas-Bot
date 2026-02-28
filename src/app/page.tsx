import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  ArrowRight, Search, Brain, CheckCircle, Send, BarChart3,
  Clock, Users, Shield, Target, Sparkles, ChevronRight,
} from 'lucide-react';
import { LogoIcon } from '@/components/Logo';

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="w-8 h-8" />
            <span className="text-lg font-bold">GetMention</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-xs text-muted-foreground mb-6">
            <Sparkles className="w-3 h-3 text-primary" />
            AI-Powered Social Engagement
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
            Automate Social Media
            <span className="block text-primary mt-1">Engagement at Scale</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            GetMention monitors social platforms for relevant conversations, uses AI to craft intelligent replies, and posts them automatically — turning social listening into actionable engagement.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href={isLoggedIn ? '/dashboard' : '/sign-up'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {isLoggedIn ? 'Open Dashboard' : 'Start Free'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
            >
              See How It Works
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Platform Pills */}
          <div className="mt-12 flex items-center justify-center gap-3 flex-wrap">
            {[
              { name: 'Twitter/X', bg: 'bg-black' },
              { name: 'Reddit', bg: 'bg-orange-600' },
              { name: 'Facebook', bg: 'bg-blue-600' },
              { name: 'Quora', bg: 'bg-red-600' },
              { name: 'YouTube', bg: 'bg-red-500' },
              { name: 'Pinterest', bg: 'bg-red-700' },
            ].map((p) => (
              <span
                key={p.name}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white ${p.bg}`}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              A fully automated 6-stage pipeline from discovery to engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                step: '1',
                title: 'Scrape',
                desc: 'Automatically crawls social platforms for posts matching your target keywords across Twitter, Reddit, Facebook, Quora, YouTube, and Pinterest.',
              },
              {
                icon: Brain,
                step: '2',
                title: 'Evaluate',
                desc: 'AI scores each post for relevance (0-100), analyzes tone, detects competitor mentions, and generates a tailored reply suggestion.',
              },
              {
                icon: CheckCircle,
                step: '3',
                title: 'Review & Approve',
                desc: 'Review AI suggestions in your dashboard. Edit replies, adjust tone, or approve/reject posts with a single click.',
              },
              {
                icon: Send,
                step: '4',
                title: 'Auto-Post',
                desc: 'Approved replies are posted directly to the platform via your connected accounts. Set score thresholds for fully automated posting.',
              },
              {
                icon: BarChart3,
                step: '5',
                title: 'Track',
                desc: 'Monitor engagement metrics on posted replies. Track which keywords and tones drive the best results per platform.',
              },
              {
                icon: Clock,
                step: '6',
                title: 'Schedule',
                desc: 'Set custom intervals (15 min to 2 hours) for automated pipeline runs. Configure active hours and days per platform.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {item.step}</span>
                    <h3 className="text-base font-semibold text-foreground leading-tight">{item.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Powerful Features</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Everything you need to automate social media engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Replies',
                desc: 'Custom AI evaluates relevance, analyzes tone, and generates natural-sounding replies tailored to each platform.',
              },
              {
                icon: Target,
                title: 'Competitor Intelligence',
                desc: 'Track competitors by name and URL. AI detects mentions, analyzes sentiment, and scores engagement opportunities.',
              },
              {
                icon: Sparkles,
                title: 'A/B Testing',
                desc: 'Generate multiple reply variations with different tones. Track performance per platform and auto-optimize over time.',
              },
              {
                icon: Users,
                title: 'Team Collaboration',
                desc: 'Invite team members with role-based access (owner, editor, reviewer). Activity feed tracks all team actions.',
              },
              {
                icon: Shield,
                title: 'Cookie Health Monitor',
                desc: 'Automated monitoring of browser session health. Get alerts when cookies expire so your accounts stay connected.',
              },
              {
                icon: Clock,
                title: 'Smart Scheduling',
                desc: 'Set timezone-aware schedules with active hours and days. Configure intervals from 15 minutes to 2 hours per platform.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">Get Started in Minutes</h2>
            <p className="mt-3 text-muted-foreground">
              Four simple steps to automate your social engagement.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                num: '1',
                title: 'Set Up Your Company Profile',
                desc: 'Enter your company name and description so the AI understands your brand voice and generates relevant replies.',
              },
              {
                num: '2',
                title: 'Add Target Keywords',
                desc: 'Define the keywords and topics you want to monitor. The scraper will find conversations matching these terms.',
              },
              {
                num: '3',
                title: 'Connect Your Platforms',
                desc: 'Link your social media accounts by providing browser cookies. Supports Twitter/X, Reddit, Facebook, Quora, YouTube, and Pinterest.',
              },
              {
                num: '4',
                title: 'Run the Pipeline',
                desc: 'Hit "Start Job" to scrape, evaluate, and review posts. Enable auto-posting to let the system handle everything.',
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 border-t border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Automate Your Engagement?</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Stop manually replying to social media posts. Let AI handle the heavy lifting.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href={isLoggedIn ? '/dashboard' : '/sign-up'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Create Free Account'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!isLoggedIn && (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoIcon className="w-6 h-6" />
            <span className="text-sm font-semibold">GetMention</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Social engagement automation platform. Built with AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
