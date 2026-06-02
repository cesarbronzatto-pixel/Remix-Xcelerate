import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { commentService } from '../services/commentService';
import { gamificationService } from '../services/gamificationService';
import { Comment } from '../types';
import { MiniBadge } from './gamification/MiniBadge';
import { 
  MessageSquare, 
  Heart, 
  Reply, 
  Trash2, 
  Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from './ConfirmModal';

interface ModuleCommentsProps {
  moduleId: string;
}

interface CommentItemProps {
  comment: Comment;
  onLike: () => void | Promise<void>;
  onReply: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  currentUserId?: string;
  isAdmin?: boolean;
  isReply: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onLike, onReply, onDelete, currentUserId, isAdmin, isReply }) => {
  const isLiked = currentUserId && comment.likes?.includes(currentUserId);
  const isAuthor = currentUserId === comment.userId;
  const canDelete = isAuthor || isAdmin;

  return (
    <div className="group">
      <div className="flex gap-3">
        <img 
          src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userName}&backgroundColor=1e3a8a`} 
          alt={comment.userName}
          className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg shrink-0 object-cover`}
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-2">
                <span className={`font-bold truncate ${isReply ? 'text-xs' : 'text-sm'} text-slate-900 dark:text-white`}>
                  {comment.userName}
                </span>
                <MiniBadge badges={comment.userBadges || []} level={comment.userLevel} showLevel />
              </div>
              <span className="text-[10px] text-slate-400">
                {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            {canDelete && (
              <button 
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className={`${isReply ? 'text-xs' : 'text-sm'} text-slate-600 dark:text-slate-300 leading-relaxed break-words`}>
            {comment.text}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={onLike}
              className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${
                isLiked ? 'text-pink-500' : 'text-slate-400 hover:text-pink-500'
              }`}
            >
              <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
              {comment.likes?.length || 0}
            </button>
            {!isReply && (
              <button 
                onClick={onReply}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors"
              >
                <Reply className="w-3 h-3" />
                Responder
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModuleComments({ moduleId }: ModuleCommentsProps) {
  const { user, userProfile } = useAuth();
  const { hasPermission, isManagementAdmin } = usePermissions();
  const isAdmin = isManagementAdmin;
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId || !user) return;
    const unsubscribe = commentService.getComments(moduleId, (data) => {
      setComments(data);
    });
    return () => unsubscribe();
  }, [moduleId, user]);

  const handlePostComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const text = parentId ? replyText : newComment;
    if (!user || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await commentService.addComment({
        moduleId,
        userId: user.uid,
        userName: userProfile?.name || user.displayName || 'Usuário',
        userPhoto: userProfile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email || 'user'}&backgroundColor=1e3a8a`,
        userLevel: userProfile?.level || 1,
        userBadges: userProfile?.badges || [],
        text: text.trim(),
        createdAt: Date.now(),
        likes: [],
        parentId
      });

      // Award points for engagement (secretly)
      if (!isManagementAdmin) {
        await gamificationService.awardEngagementPoints(user.uid, parentId ? 'reply' : 'comment');
      }
      
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (!user) return;
    const comment = comments.find(c => c.id === commentId);
    const wasLiked = comment?.likes?.includes(user.uid);
    
    await commentService.toggleLike(commentId, user.uid);

    // Award points for liking (only if it's a new like and not an admin)
    if (!wasLiked && !isManagementAdmin) {
      await gamificationService.awardEngagementPoints(user.uid, 'like');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await commentService.deleteComment(commentId);
    setCommentToDelete(null);
  };

  const mainComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-900 dark:text-white">Comentários ({comments.length})</h3>
      </div>

      {/* New Comment Input */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <form onSubmit={(e) => handlePostComment(e)} className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="O que você achou deste vídeo?"
            className="w-full p-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all dark:text-white"
            rows={2}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {mainComments.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Seja o primeiro a comentar!</p>
          </div>
        ) : (
          mainComments.map((comment) => (
            <div key={comment.id} className="space-y-4">
              <CommentItem 
                comment={comment}
                onLike={() => handleToggleLike(comment.id!)}
                onReply={() => setReplyingTo(comment.id!)}
                onDelete={() => setCommentToDelete(comment.id!)}
                currentUserId={user?.uid}
                isAdmin={isAdmin}
                isReply={false}
              />

              {/* Replies */}
              <div className="ml-8 space-y-4 border-l-2 border-slate-100 dark:border-slate-800 pl-4">
                {getReplies(comment.id!).map((reply) => (
                  <CommentItem 
                    key={reply.id}
                    comment={reply}
                    onLike={() => handleToggleLike(reply.id!)}
                    onReply={() => setReplyingTo(comment.id!)}
                    onDelete={() => setCommentToDelete(reply.id!)}
                    currentUserId={user?.uid}
                    isAdmin={isAdmin}
                    isReply={true}
                  />
                ))}

                {/* Reply Input */}
                <AnimatePresence>
                  {replyingTo === comment.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="pt-2"
                    >
                      <form onSubmit={(e) => handlePostComment(e, comment.id!)} className="relative">
                        <textarea
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Respondendo a ${comment.userName}...`}
                          className="w-full p-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all dark:text-white"
                          rows={2}
                        />
                        <div className="absolute right-2 bottom-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={!replyText.trim() || isSubmitting}
                            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={commentToDelete !== null}
        title="Excluir Comentário"
        message="Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita."
        onConfirm={() => commentToDelete && handleDeleteComment(commentToDelete)}
        onCancel={() => setCommentToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
