// Updated: Collaboration interfaces

import { Comment, Review, ReviewStatus } from '@prisma/client';

export interface CollaborationActivity {
  id: string;
  type: 'comment' | 'review' | 'edit' | 'approval';
  userId: string;
  userName: string;
  userAvatar?: string;
  specificationId: string;
  timestamp: Date;
  data: any;
}

export interface CommentThread {
  comment: Comment & {
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    replies?: CommentThread[];
  };
}

export interface ReviewRequest {
  specificationId: string;
  reviewerId: string;
  message?: string;
  dueDate?: Date;
}

export interface ReviewDecision {
  reviewId: string;
  status: ReviewStatus;
  feedback: string;
}

export interface CollaborationStats {
  totalComments: number;
  unresolvedComments: number;
  totalReviews: number;
  pendingReviews: number;
  activeCollaborators: number;
  lastActivity?: Date;
}

export interface RealtimeCollaborationEvent {
  type: 'user_joined' | 'user_left' | 'comment_added' | 'comment_updated' |
        'review_submitted' | 'spec_updated' | 'typing' | 'cursor_moved';
  userId: string;
  userName: string;
  specificationId: string;
  data?: any;
}

// ============================================