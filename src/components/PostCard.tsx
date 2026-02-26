'use client';

import { useState } from 'react';
import type { IPost, WorkspaceRole, ReplyVariation } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface PostCardProps {
  post: IPost;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  role?: WorkspaceRole;
}

export default function PostCard({ post, onUpdate, role = 'owner' }: PostCardProps) {
  const [editedReply, setEditedReply] = useState(post.editedReply || post.aiReply || '');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string>('');
  const [selectedVariation, setSelectedVariation] = useState(
    post.selectedVariationIndex ?? (post.aiReplies && post.aiReplies.length > 0 ? 0 : -1)
  );

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

  const replyText = hasVariations && selectedVariation >= 0
    ? variations[selectedVariation].text
    : post.editedReply || post.aiReply;

  const competitorSentimentColor = {
    negative: 'bg-amber-100 text-amber-700 border-amber-200',
    positive: 'bg-blue-100 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-gray-900">{post.author}</span>
            <StatusBadge status={post.status} />
            {post.aiRelevanceScore !== undefined && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                post.aiRelevanceScore >= 70 ? 'bg-green-50 text-green-700' :
                post.aiRelevanceScore >= 40 ? 'bg-yellow-50 text-yellow-700' :
                'bg-red-50 text-red-700'
              }`}>
                Score: {post.aiRelevanceScore}
              </span>
            )}
            {post.aiTone && (
              <span className="text-xs text-gray-500">Tone: {post.aiTone}</span>
            )}
            {/* Competitor badge */}
            {post.competitorMentioned && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                competitorSentimentColor[post.competitorSentiment as keyof typeof competitorSentimentColor] || competitorSentimentColor.neutral
              }`}>
                {post.competitorMentioned}
                {post.competitorSentiment && ` (${post.competitorSentiment})`}
              </span>
            )}
            {/* Opportunity pill */}
            {post.isCompetitorOpportunity && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500 text-white">
                Opportunity
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {post.platform} &middot; {new Date(post.scrapedAt).toLocaleDateString()}
          </p>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 text-sm shrink-0"
        >
          View original
        </a>
      </div>

      <div className="bg-gray-50 rounded-md p-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>
      </div>

      {post.keywordsMatched && post.keywordsMatched.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {post.keywordsMatched.map((kw) => (
            <span key={kw} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {kw}
            </span>
          ))}
        </div>
      )}

      {post.aiReasoning && (
        <p className="text-xs text-gray-500 italic">AI Reasoning: {post.aiReasoning}</p>
      )}

      {/* A/B Testing: Variation Selector */}
      {hasVariations && post.status !== 'posted' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Reply Variations:</label>
          <div className="grid gap-2">
            {variations.map((v, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedVariation(i);
                  setEditedReply(v.text);
                }}
                className={`text-left rounded-lg p-3 border-2 transition-colors ${
                  selectedVariation === i
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selectedVariation === i ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {v.tone}
                  </span>
                  {selectedVariation === i && (
                    <span className="text-xs text-blue-600 font-medium">Selected</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{v.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Single reply display (backward compat) */}
      {!hasVariations && replyText && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {post.status === 'posted' ? 'Posted Reply:' : 'Suggested Reply:'}
          </label>
          {editing ? (
            <textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          ) : (
            <div className={`rounded-md p-3 ${post.status === 'posted' ? 'bg-indigo-50 border border-indigo-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{editedReply || replyText}</p>
              {post.status === 'posted' && post.postedAt && (
                <p className="text-xs text-indigo-400 mt-1.5">
                  Posted {new Date(post.postedAt).toLocaleString()}
                  {post.postedTone && ` (${post.postedTone} tone)`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Posted variations display */}
      {hasVariations && post.status === 'posted' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Posted Reply:</label>
          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {post.selectedVariationIndex !== undefined && post.selectedVariationIndex >= 0
                ? variations[post.selectedVariationIndex]?.text || post.aiReply
                : post.aiReply}
            </p>
            {post.postedAt && (
              <p className="text-xs text-indigo-400 mt-1.5">
                Posted {new Date(post.postedAt).toLocaleString()}
                {post.postedTone && ` (${post.postedTone} tone)`}
              </p>
            )}
          </div>
        </div>
      )}

      {canAct && (post.status === 'evaluated' || post.status === 'new') && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleAction('approved')}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {editing ? 'Done Editing' : 'Edit Reply'}
          </button>
          <button
            onClick={() => handleAction('rejected')}
            disabled={loading}
            className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {canAct && post.status === 'approved' && (
        <div className="flex gap-2 pt-2 flex-wrap items-center">
          {post.platform === 'twitter' && (
            <button
              onClick={() => handlePostToplatform('/api/post-reply', 'X')}
              disabled={posting}
              className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to X'}
            </button>
          )}
          {post.platform === 'facebook' && (
            <button
              onClick={() => handlePostToplatform('/api/fb-post-reply', 'Facebook')}
              disabled={posting}
              className="px-4 py-2 bg-[#1877F2] text-white text-sm rounded-md hover:bg-[#1565d8] disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to Facebook'}
            </button>
          )}
          {post.platform === 'reddit' && (
            <button
              onClick={() => handlePostToplatform('/api/rd-post-reply', 'Reddit')}
              disabled={posting}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to Reddit'}
            </button>
          )}
          {post.platform === 'quora' && (
            <button
              onClick={() => handlePostToplatform('/api/qa-post-reply', 'Quora')}
              disabled={posting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to Quora'}
            </button>
          )}
          {post.platform === 'youtube' && (
            <button
              onClick={() => handlePostToplatform('/api/yt-post-reply', 'YouTube')}
              disabled={posting}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to YouTube'}
            </button>
          )}
          {post.platform === 'pinterest' && (
            <button
              onClick={() => handlePostToplatform('/api/pin-post-reply', 'Pinterest')}
              disabled={posting}
              className="px-4 py-2 bg-red-700 text-white text-sm rounded-md hover:bg-red-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? 'Posting...' : 'Post to Pinterest'}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(editedReply || replyText || '');
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
          >
            Copy Reply
          </button>
          <button
            onClick={() => handleAction('posted')}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-50"
          >
            Mark as Posted
          </button>
          {postResult && (
            <span className={`text-sm ${postResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {postResult}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
