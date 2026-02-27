'use client';

import { useState } from 'react';
import type { IPost, WorkspaceRole, ReplyVariation } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { PLATFORM_MAP, PlatformIcon } from '@/lib/platforms/config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Check, X, Pencil, Send, Copy, ExternalLink, Loader2, CheckCircle2, Zap,
} from 'lucide-react';

interface PostCardProps {
  post: IPost;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  role?: WorkspaceRole;
}

const VARIATION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function PostCard({ post, onUpdate, role = 'owner' }: PostCardProps) {
  const [editedReply, setEditedReply] = useState(post.editedReply || post.aiReply || '');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string>('');
  const [selectedVariation, setSelectedVariation] = useState(
    post.selectedVariationIndex ?? (post.aiReplies && post.aiReplies.length > 0 ? 0 : -1)
  );
  const [copied, setCopied] = useState(false);

  const canAct = role === 'owner' || role === 'editor';
  const variations = (post.aiReplies || []) as ReplyVariation[];
  const hasVariations = variations.length > 1;

  const handleAction = async (status: string) => {
    setLoading(true);
    const data: Record<string, unknown> = { status };
    if (editedReply !== post.aiReply) data.editedReply = editedReply;
    if (hasVariations && selectedVariation >= 0) {
      data.selectedVariationIndex = selectedVariation;
    }
    await onUpdate(post._id!, data);
    setLoading(false);
  };

  const handlePostToplatform = async (endpoint: string, platformLabel: string) => {
    setPosting(true);
    setPostResult('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post._id }),
      });
      const data = await res.json();
      if (data.success) {
        setPostResult(`Posted to ${platformLabel}!`);
        await onUpdate(post._id!, {});
      } else {
        setPostResult(`Error: ${data.error}`);
      }
    } catch {
      setPostResult(`Failed to post to ${platformLabel}`);
    }
    setPosting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedReply || replyText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const replyText = hasVariations && selectedVariation >= 0
    ? variations[selectedVariation].text
    : post.editedReply || post.aiReply;

  const competitorSentimentColor: Record<string, string> = {
    negative: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    positive: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  const platformConfig = PLATFORM_MAP[post.platform];

  return (
    <Card className={
      post.status === 'posted' && post.autoPosted
        ? 'border-cyan-500/30'
        : post.status === 'posted'
        ? 'border-emerald-500/30'
        : post.status === 'approved' && post.autoApproved
        ? 'border-amber-500/30'
        : post.status === 'approved'
        ? 'border-green-500/30'
        : ''
    }>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <PlatformIcon platform={post.platform} />
              <span className="font-semibold text-foreground truncate">{post.author}</span>
              <StatusBadge status={post.status} />
              {post.autoApproved && (
                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1">
                  <Zap className="w-3 h-3" />
                  Auto
                </Badge>
              )}
              {post.autoPosted && (
                <Badge variant="outline" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 gap-1">
                  <Zap className="w-3 h-3" />
                  Auto-Posted
                </Badge>
              )}
              {post.aiRelevanceScore !== undefined && (
                <Badge variant="outline" className={
                  post.aiRelevanceScore >= 70 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                  post.aiRelevanceScore >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                  'bg-red-500/15 text-red-400 border-red-500/30'
                }>
                  {post.aiRelevanceScore}/100
                </Badge>
              )}
              {post.aiTone && (
                <Badge variant="secondary">{post.aiTone}</Badge>
              )}
              {post.competitorMentioned && (
                <Badge variant="outline" className={
                  competitorSentimentColor[post.competitorSentiment as string] || competitorSentimentColor.neutral
                }>
                  {post.competitorMentioned}
                  {post.competitorSentiment && ` (${post.competitorSentiment})`}
                </Badge>
              )}
              {post.isCompetitorOpportunity && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-600">Opportunity</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(post.scrapedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              {post.status === 'posted' && post.postedAt && (
                <span className={`ml-2 font-medium ${post.autoPosted ? 'text-cyan-400' : 'text-emerald-400'}`}>
                  {post.autoPosted ? 'Auto-posted' : 'Posted'} {new Date(post.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="gap-1">
              <ExternalLink className="w-3.5 h-3.5" />
              Original
            </a>
          </Button>
        </div>

        {/* Content */}
        <div className="bg-muted/50 rounded-lg p-3.5 border border-border">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        {/* Keywords */}
        {post.keywordsMatched && post.keywordsMatched.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {post.keywordsMatched.map((kw) => (
              <Badge key={kw} variant="secondary">{kw}</Badge>
            ))}
          </div>
        )}

        {/* AI Reasoning */}
        {post.aiReasoning && (
          <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-3 py-2 border border-border">
            AI: {post.aiReasoning}
          </p>
        )}

        {/* A/B Testing: Variation Selector */}
        {hasVariations && post.status !== 'posted' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Reply Variations</label>
            <div className="grid gap-2">
              {variations.map((v, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedVariation(i);
                    setEditedReply(v.text);
                  }}
                  className={`text-left rounded-xl p-3.5 border-2 transition-all ${
                    selectedVariation === i
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      selectedVariation === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {VARIATION_LETTERS[i] || i + 1}
                    </span>
                    <Badge variant={selectedVariation === i ? 'default' : 'secondary'}>{v.tone}</Badge>
                    {selectedVariation === i && (
                      <span className="text-xs text-primary font-semibold flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        Selected
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{v.text.length} chars</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{v.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single reply display */}
        {!hasVariations && replyText && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              {post.status === 'posted' ? 'Posted Reply' : 'Suggested Reply'}
            </label>
            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedReply}
                  onChange={(e) => setEditedReply(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground text-right">{editedReply.length} characters</p>
              </div>
            ) : (
              <div className={`rounded-xl p-3.5 ${
                post.status === 'posted'
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-green-500/10 border border-green-500/30'
              }`}>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{editedReply || replyText}</p>
                {post.status === 'posted' && post.postedAt && (
                  <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${post.autoPosted ? 'border-cyan-500/20' : 'border-emerald-500/20'}`}>
                    {post.autoPosted ? (
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <p className={`text-xs font-medium ${post.autoPosted ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      {post.autoPosted ? 'Auto-posted' : 'Posted'} {new Date(post.postedAt).toLocaleString()}
                      {post.postedTone && <span className="opacity-80"> &middot; {post.postedTone} tone</span>}
                    </p>
                    {post.replyUrl && (
                      <a
                        href={post.replyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs font-medium text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                      >
                        View reply
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Posted variations display */}
        {hasVariations && post.status === 'posted' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              {post.autoPosted ? 'Auto-Posted Reply' : 'Posted Reply'}
              {post.autoPosted && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
            </label>
            <div className={`${post.autoPosted ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'} rounded-xl p-3.5`}>
              <div className="flex items-center gap-2 mb-2">
                {post.selectedVariationIndex !== undefined && post.selectedVariationIndex >= 0 && (
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                    {VARIATION_LETTERS[post.selectedVariationIndex] || post.selectedVariationIndex + 1}
                  </span>
                )}
                {post.postedTone && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
                    {post.postedTone}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {post.selectedVariationIndex !== undefined && post.selectedVariationIndex >= 0
                  ? variations[post.selectedVariationIndex]?.text || post.aiReply
                  : post.aiReply}
              </p>
              {post.postedAt && (
                <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${post.autoPosted ? 'border-cyan-500/20' : 'border-emerald-500/20'}`}>
                  {post.autoPosted ? (
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <p className={`text-xs font-medium ${post.autoPosted ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {post.autoPosted ? 'Auto-posted' : 'Posted'} {new Date(post.postedAt).toLocaleString()}
                  </p>
                  {post.replyUrl && (
                    <a
                      href={post.replyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`ml-auto text-xs font-medium underline flex items-center gap-1 ${post.autoPosted ? 'text-cyan-400 hover:text-cyan-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                    >
                      View reply
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approve / Edit / Reject actions */}
        {canAct && (post.status === 'evaluated' || post.status === 'new') && (
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleAction('approved')} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4" />
              Approve
            </Button>
            <Button onClick={() => setEditing(!editing)} size="sm" variant="default">
              <Pencil className="w-4 h-4" />
              {editing ? 'Done' : 'Edit'}
            </Button>
            <Button onClick={() => handleAction('rejected')} disabled={loading} size="sm" variant="destructive">
              <X className="w-4 h-4" />
              Reject
            </Button>
          </div>
        )}

        {/* Post to Platform actions */}
        {canAct && post.status === 'approved' && (
          <div className="flex gap-2 pt-2 flex-wrap items-center">
            {platformConfig && (
              <Button
                onClick={() => handlePostToplatform(platformConfig.postEndpoint, platformConfig.postLabel.replace('Post to ', ''))}
                disabled={posting}
                size="sm"
                className={`${platformConfig.bgClass} text-white hover:opacity-90`}
              >
                {posting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <PlatformIcon platform={post.platform} className="w-4 h-4 !bg-transparent" />
                    {platformConfig.postLabel}
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleCopy} size="sm" variant="outline">
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Reply
                </>
              )}
            </Button>
            <Button onClick={() => handleAction('posted')} disabled={loading} size="sm" variant="secondary">
              <Check className="w-4 h-4" />
              Mark as Posted
            </Button>
            {postResult && (
              <span className={`text-sm font-medium flex items-center gap-1 ${postResult.startsWith('Error') || postResult.startsWith('Failed') ? 'text-destructive' : 'text-green-500'}`}>
                {!postResult.startsWith('Error') && !postResult.startsWith('Failed') && (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {postResult}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
