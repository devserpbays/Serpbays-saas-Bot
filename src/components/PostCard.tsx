'use client';

import { useState } from 'react';
import type { IPost, WorkspaceRole, ReplyVariation } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface PostCardProps {
  post: IPost;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  role?: WorkspaceRole;
}

/* ── Platform icon SVGs (small inline, 14x14) ── */
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  reddit: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  quora: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M12.071 0C5.4 0 .001 5.4.001 12.071c0 6.248 4.759 11.41 10.85 12.003-.044-.562-.094-1.407-.094-2.001 0-.666.023-1.406.068-2.028-.447.045-.896.068-1.349.068-3.734 0-5.941-2.162-5.941-5.95 0-3.78 2.207-5.941 5.941-5.941 3.733 0 5.94 2.161 5.94 5.941 0 1.873-.509 3.374-1.407 4.38l1.047 1.986c.423.806.847 1.166 1.336 1.166.888 0 1.406-.949 1.406-2.688V12.07C17.8 6.37 15.292 0 12.071 0zm-1.595 17.624c.263-.01.526-.022.786-.022h.026l-.803-1.523c.598-.861.941-2.083.941-3.578 0-3.022-1.73-4.697-4.689-4.697-2.97 0-4.7 1.675-4.7 4.697 0 3.031 1.73 4.706 4.7 4.706.575 0 1.127-.056 1.739-.183z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  pinterest: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
    </svg>
  ),
};

const PLATFORM_BUTTON_STYLES: Record<string, { bg: string; hover: string; label: string; endpoint: string }> = {
  twitter:   { bg: 'bg-black',      hover: 'hover:bg-gray-800',  label: 'Post to X',         endpoint: '/api/post-reply' },
  reddit:    { bg: 'bg-orange-600',  hover: 'hover:bg-orange-700', label: 'Post to Reddit',    endpoint: '/api/rd-post-reply' },
  facebook:  { bg: 'bg-[#1877F2]',   hover: 'hover:bg-[#1565d8]', label: 'Post to Facebook',  endpoint: '/api/fb-post-reply' },
  quora:     { bg: 'bg-red-600',     hover: 'hover:bg-red-700',   label: 'Post to Quora',     endpoint: '/api/qa-post-reply' },
  youtube:   { bg: 'bg-red-500',     hover: 'hover:bg-red-600',   label: 'Post to YouTube',   endpoint: '/api/yt-post-reply' },
  pinterest: { bg: 'bg-red-700',     hover: 'hover:bg-red-800',   label: 'Post to Pinterest', endpoint: '/api/pin-post-reply' },
};

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

  const competitorSentimentColor = {
    negative: 'bg-amber-100 text-amber-700 border-amber-200',
    positive: 'bg-blue-100 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const platformStyle = PLATFORM_BUTTON_STYLES[post.platform];
  const platformIcon = PLATFORM_ICONS[post.platform];

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-md ${
      post.status === 'posted'
        ? 'border-emerald-200 shadow-sm'
        : post.status === 'approved'
        ? 'border-green-200 shadow-sm'
        : 'border-gray-200 shadow-sm'
    } p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Platform icon */}
            {platformIcon && (
              <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-white ${
                post.platform === 'twitter' ? 'bg-black' :
                post.platform === 'reddit' ? 'bg-orange-600' :
                post.platform === 'facebook' ? 'bg-blue-600' :
                post.platform === 'quora' ? 'bg-red-600' :
                post.platform === 'youtube' ? 'bg-red-500' :
                post.platform === 'pinterest' ? 'bg-red-700' : 'bg-gray-600'
              }`}>
                {platformIcon}
              </span>
            )}
            <span className="font-semibold text-gray-900 truncate">{post.author}</span>
            <StatusBadge status={post.status} />
            {post.aiRelevanceScore !== undefined && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                post.aiRelevanceScore >= 70 ? 'bg-green-50 text-green-700 ring-1 ring-green-200' :
                post.aiRelevanceScore >= 40 ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' :
                'bg-red-50 text-red-700 ring-1 ring-red-200'
              }`}>
                {post.aiRelevanceScore}/100
              </span>
            )}
            {post.aiTone && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {post.aiTone}
              </span>
            )}
            {post.competitorMentioned && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                competitorSentimentColor[post.competitorSentiment as keyof typeof competitorSentimentColor] || competitorSentimentColor.neutral
              }`}>
                {post.competitorMentioned}
                {post.competitorSentiment && ` (${post.competitorSentiment})`}
              </span>
            )}
            {post.isCompetitorOpportunity && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                Opportunity
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {new Date(post.scrapedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {post.status === 'posted' && post.postedAt && (
              <span className="ml-2 text-emerald-500 font-medium">
                Posted {new Date(post.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </p>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs font-medium shrink-0 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Original
        </a>
      </div>

      {/* Content */}
      <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {/* Keywords */}
      {post.keywordsMatched && post.keywordsMatched.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {post.keywordsMatched.map((kw) => (
            <span key={kw} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ring-1 ring-blue-100 font-medium">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* AI Reasoning */}
      {post.aiReasoning && (
        <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          AI: {post.aiReasoning}
        </p>
      )}

      {/* A/B Testing: Variation Selector */}
      {hasVariations && post.status !== 'posted' && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Reply Variations</label>
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
                    ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    selectedVariation === i ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {VARIATION_LETTERS[i] || i + 1}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    selectedVariation === i ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {v.tone}
                  </span>
                  {selectedVariation === i && (
                    <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Selected
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{v.text.length} chars</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{v.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Single reply display */}
      {!hasVariations && replyText && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            {post.status === 'posted' ? 'Posted Reply' : 'Suggested Reply'}
          </label>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                className="w-full border border-blue-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
                rows={4}
              />
              <p className="text-xs text-gray-400 text-right">{editedReply.length} characters</p>
            </div>
          ) : (
            <div className={`rounded-xl p-3.5 ${
              post.status === 'posted'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{editedReply || replyText}</p>
              {post.status === 'posted' && post.postedAt && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-200/60">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                  <p className="text-xs text-emerald-600 font-medium">
                    Posted {new Date(post.postedAt).toLocaleString()}
                    {post.postedTone && <span className="text-emerald-500"> &middot; {post.postedTone} tone</span>}
                  </p>
                  {post.replyUrl && (
                    <a
                      href={post.replyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-800 underline flex items-center gap-1"
                    >
                      View reply
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
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
          <label className="text-sm font-semibold text-gray-700">Posted Reply</label>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              {post.selectedVariationIndex !== undefined && post.selectedVariationIndex >= 0 && (
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                  {VARIATION_LETTERS[post.selectedVariationIndex] || post.selectedVariationIndex + 1}
                </span>
              )}
              {post.postedTone && (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {post.postedTone}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {post.selectedVariationIndex !== undefined && post.selectedVariationIndex >= 0
                ? variations[post.selectedVariationIndex]?.text || post.aiReply
                : post.aiReply}
            </p>
            {post.postedAt && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-200/60">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                <p className="text-xs text-emerald-600 font-medium">
                  Posted {new Date(post.postedAt).toLocaleString()}
                </p>
                {post.replyUrl && (
                  <a
                    href={post.replyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-800 underline flex items-center gap-1"
                  >
                    View reply
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
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
          <button
            onClick={() => handleAction('approved')}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Approve
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => handleAction('rejected')}
            disabled={loading}
            className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
        </div>
      )}

      {/* Post to Platform actions */}
      {canAct && post.status === 'approved' && (
        <div className="flex gap-2 pt-2 flex-wrap items-center">
          {platformStyle && (
            <button
              onClick={() => handlePostToplatform(platformStyle.endpoint, platformStyle.label.replace('Post to ', ''))}
              disabled={posting}
              className={`px-4 py-2.5 ${platformStyle.bg} text-white text-sm font-medium rounded-lg ${platformStyle.hover} disabled:opacity-50 transition-all flex items-center gap-2`}
            >
              {posting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Posting...
                </>
              ) : (
                <>
                  {platformIcon}
                  {platformStyle.label}
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5 border border-gray-200"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Copy Reply
              </>
            )}
          </button>
          <button
            onClick={() => handleAction('posted')}
            disabled={loading}
            className="px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Mark as Posted
          </button>
          {postResult && (
            <span className={`text-sm font-medium flex items-center gap-1 ${postResult.startsWith('Error') || postResult.startsWith('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {!postResult.startsWith('Error') && !postResult.startsWith('Failed') && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
              {postResult}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
