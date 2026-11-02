import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetTicketByIdQuery,
  useGetCommentsQuery,
  useAddCommentMutation,
  useUpdateTicketStatusMutation,
  useUpdateTicketClassificationMutation,
  useGetSuggestedReplyMutation,
  useAutoResolveTicketMutation,
} from '../features/tickets/ticketsApi';
import { selectCurrentUser } from '../features/auth/authSlice';
import { ROLES } from '../constants/roles';
import { TICKET_STATUS_OPTIONS } from '../features/tickets/ticketStatus';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../features/tickets/ticketClassification';
import StatusBadge from '../components/StatusBadge';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

export default function TicketDetailPage() {
  const { id } = useParams();
  const ticketId = Number(id);
  const user = useSelector(selectCurrentUser);

  const {
    data: ticket,
    isLoading: isTicketLoading,
    error: ticketError,
  } = useGetTicketByIdQuery(ticketId);

  const {
    data: comments,
    isLoading: isCommentsLoading,
    error: commentsError,
  } = useGetCommentsQuery(ticketId);

  const [addComment, { isLoading: isPostingComment, error: addCommentError }] =
    useAddCommentMutation();

  const [updateStatus, { isLoading: isUpdatingStatus, error: statusError }] =
    useUpdateTicketStatusMutation();

  const [
    updateClassification,
    { isLoading: isUpdatingClassification, error: classificationError },
  ] = useUpdateTicketClassificationMutation();

  const [
    getSuggestedReply,
    { data: suggestedReplyData, isLoading: isGeneratingReply, error: suggestedReplyError },
  ] = useGetSuggestedReplyMutation();

  const [
    autoResolveTicket,
    { isLoading: isAutoResolving, error: autoResolveError },
  ] = useAutoResolveTicketMutation();

  const [commentText, setCommentText] = useState('');

  // The suggested-reply text is a separate, editable draft rather than
  // being tied directly to `suggestedReplyData` - once generated, the
  // agent should be free to edit it without every re-render (or an
  // unrelated refetch elsewhere on the page) clobbering their edits.
  // It's only overwritten when a *new* generation actually completes
  // (initial load or "Regenerate"), handled in the effect below.
  const [replyDraft, setReplyDraft] = useState('');

  // Backend authorization matches these UI checks exactly:
  //   AddComment            -> [Authorize(Roles = "User, Agent")]
  //   UpdateStatus           -> [Authorize(Roles = "Agent, Admin")]
  //   UpdateClassification   -> [Authorize(Roles = "Agent, Admin")]
  //   GetSuggestedReply      -> [Authorize(Roles = "Agent, Admin")]
  const canComment = user?.role === ROLES.USER || user?.role === ROLES.AGENT;
  const canChangeStatus = user?.role === ROLES.AGENT || user?.role === ROLES.ADMIN;
  const canEditClassification = canChangeStatus;
  const canUseAiAssist = canChangeStatus;

  // Fires once per ticket visit (when the ticket has loaded and this
  // user is allowed to see AI assist) to fetch-or-generate the suggested
  // reply. This is the "call /rag/generate when an agent opens a ticket"
  // behavior - the backend itself returns the cached result on this call
  // if one already exists, so this does NOT force a fresh (slow, costly)
  // generation on every page visit; only the explicit "Regenerate"
  // button does that, via handleRegenerateReply below.
  useEffect(() => {
    if (ticket && canUseAiAssist) {
      getSuggestedReply({ id: ticketId })
        .unwrap()
        .then((result) => setReplyDraft(result.suggestedReply))
        .catch(() => {
          // surfaced via suggestedReplyError
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, canUseAiAssist]);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment({ id: ticketId, content: commentText }).unwrap();
      setCommentText('');
    } catch {
      // surfaced via addCommentError
    }
  }

  async function handleStatusChange(e) {
    const status = Number(e.target.value);
    try {
      await updateStatus({ id: ticketId, status }).unwrap();
    } catch {
      // surfaced via statusError
    }
  }

  async function handleCategoryChange(e) {
    try {
      await updateClassification({ id: ticketId, category: e.target.value }).unwrap();
    } catch {
      // surfaced via classificationError
    }
  }

  async function handlePriorityChange(e) {
    try {
      await updateClassification({ id: ticketId, priority: e.target.value }).unwrap();
    } catch {
      // surfaced via classificationError
    }
  }

  async function handleRegenerateReply() {
    try {
      const result = await getSuggestedReply({ id: ticketId, regenerate: true }).unwrap();
      setReplyDraft(result.suggestedReply);
    } catch {
      // surfaced via suggestedReplyError
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyDraft.trim()) return;
    try {
      await addComment({ id: ticketId, content: replyDraft }).unwrap();
      setReplyDraft('');
    } catch {
      // surfaced via addCommentError
    }
  }

  // "Accept & Resolve" - the high-confidence fast path. Unlike
  // handleSendReply this takes the AI's suggestion VERBATIM (the agent
  // is asserting "this answer is good as-is"), posts it as a comment,
  // and closes the ticket as Resolved, all in one backend call. The
  // action is always a deliberate click - the backend never auto-resolves
  // on its own.
  async function handleAcceptAndResolve() {
    try {
      await autoResolveTicket(ticketId).unwrap();
    } catch {
      // surfaced via autoResolveError
    }
  }

  if (isTicketLoading) return <Loading />;
  if (ticketError) return <ErrorText>{getErrorMessage(ticketError)}</ErrorText>;
  if (!ticket) return null;

  return (
    <div className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>

      <div className="ticket-detail-header">
        <h1>
          #{ticket.id} - {ticket.title}
        </h1>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="ticket-detail-meta">
        <span>Requested by {ticket.createdByEmail}</span>
        <span>
          Assigned to {ticket.assignedAgentEmail || 'nobody yet'}
        </span>
        {!canEditClassification && (
          <>
            <span>Category: {ticket.category || '-'}</span>
            <span>Priority: {ticket.priority || '-'}</span>
          </>
        )}
        <span>Created {new Date(ticket.createdAt).toLocaleString()}</span>
      </div>

      <p className="ticket-detail-description">{ticket.description}</p>

      {canEditClassification && (
        <div className="ticket-status-control">
          <label>
            Category
            <select
              value={ticket.category || ''}
              disabled={isUpdatingClassification}
              onChange={handleCategoryChange}
            >
              <option value="" disabled>
                Uncategorized
              </option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select
              value={ticket.priority || ''}
              disabled={isUpdatingClassification}
              onChange={handlePriorityChange}
            >
              <option value="" disabled>
                Unset
              </option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          {classificationError && (
            <ErrorText>{getErrorMessage(classificationError)}</ErrorText>
          )}
        </div>
      )}

      {canChangeStatus && (
        <div className="ticket-status-control">
          <label>
            Update status
            <select
              value={ticket.status}
              disabled={isUpdatingStatus}
              onChange={handleStatusChange}
            >
              {TICKET_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {statusError && <ErrorText>{getErrorMessage(statusError)}</ErrorText>}
        </div>
      )}

      {canUseAiAssist && (
        <section className="ai-assist">
          <div className="ai-assist__header">
            <h2>Suggested Reply (AI)</h2>
            <button
              type="button"
              onClick={handleRegenerateReply}
              disabled={isGeneratingReply}
            >
              {isGeneratingReply ? 'Generating...' : 'Regenerate'}
            </button>
          </div>

          {suggestedReplyError && (
            <ErrorText>{getErrorMessage(suggestedReplyError)}</ErrorText>
          )}

          {/* Shown only when the backend flagged this suggestion as
              auto_resolvable (confidence cleared the configured
              threshold). It's a *signal*, not an action - the ticket is
              only resolved if the agent clicks the button. */}
          {suggestedReplyData?.autoResolvable && ticket.status !== 2 && (
            <div className="ai-assist__autoresolve">
              <span>
                High confidence match &mdash; this reply is likely safe to
                send as-is.
              </span>
              <button
                type="button"
                className="ai-assist__resolve-btn"
                onClick={handleAcceptAndResolve}
                disabled={isAutoResolving || isGeneratingReply}
              >
                {isAutoResolving ? 'Resolving...' : 'Accept & Resolve'}
              </button>
            </div>
          )}
          {autoResolveError && (
            <ErrorText>{getErrorMessage(autoResolveError)}</ErrorText>
          )}

          <form className="card-form" onSubmit={handleSendReply}>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder={
                isGeneratingReply
                  ? 'Generating a suggested reply...'
                  : 'No suggestion yet - click Regenerate, or write your own reply.'
              }
              rows={6}
              disabled={isGeneratingReply}
            />

            {suggestedReplyData && (
              <div className="ai-assist__meta">
                <span>
                  Confidence: {Math.round(suggestedReplyData.confidence * 100)}%
                </span>
                {suggestedReplyData.sources.length > 0 && (
                  <ul className="ai-assist__sources">
                    {suggestedReplyData.sources.map((source) => (
                      <li key={source.docId}>
                        {source.title} &middot; {Math.round(source.score * 100)}% match
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button type="submit" disabled={!replyDraft.trim() || isGeneratingReply}>
              Send as Reply
            </button>
          </form>
        </section>
      )}

      <section className="comment-thread">
        <h2>Comments</h2>

        {isCommentsLoading && <Loading label="Loading comments..." />}
        {commentsError && <ErrorText>{getErrorMessage(commentsError)}</ErrorText>}

        {comments && comments.length === 0 && (
          <p className="status-message">No comments yet.</p>
        )}

        {comments && comments.length > 0 && (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-list__item">
                <div className="comment-list__meta">
                  <strong>{comment.authorEmail}</strong>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p>{comment.content}</p>
              </li>
            ))}
          </ul>
        )}

        {canComment && (
          <form className="comment-form" onSubmit={handleAddComment}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              required
            />
            {addCommentError && (
              <ErrorText>{getErrorMessage(addCommentError)}</ErrorText>
            )}
            <button type="submit" disabled={isPostingComment}>
              {isPostingComment ? 'Posting...' : 'Post comment'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
