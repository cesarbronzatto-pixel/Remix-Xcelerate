export interface Country {
  id?: string;
  name: string;
  code?: string;
  isActive: boolean;
  welcomeVideoUrl?: string;
  createdAt: number;
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  earnedAt: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  roleId?: string;
  areaId?: string;
  isActive: boolean;
  createdAt: number;
  points: number;
  weeklyPoints: number;
  level: number;
  badges: UserBadge[];
  photoURL?: string;
  lastLoginAt?: number;
  streakDays?: number;
  leaderName?: string;
  leaderEmail?: string;
  jobTitle?: string;
  isOnboarding?: boolean;
  onboardingActivatedAt?: number;
  onboardingPoints?: number;
  onboardingCompletedAt?: number;
  onboardingJourney?: 'standard' | 'eir' | 'custom';
  onboardingFeedbackCompleted?: boolean;
  onboardingTasks?: {
    welcomeVideo?: boolean;
    profilePhoto?: boolean;
    exploreWall?: boolean;
    firstRecognition?: boolean;
    checkLeaderboard?: boolean;
    firstModule?: boolean;
    completeTrail?: boolean;
    satisfactionSurvey?: boolean;
  };
  awardedTrails?: string[];
  completedSurveys?: string[]; // Trail IDs
  isBlocked?: boolean;
  blockReason?: string;
  penalizedTrails?: string[];
  hasOverdueTrails?: boolean;
  overdueTrailsCount?: number;
  country?: string;
  countryId?: string;
  projectIds?: string[];
}

export interface OnboardingFeedback {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  nps: number; // 0-10
  clarity: number; // 1-5
  sentiment: 'very_confident' | 'confident' | 'neutral' | 'confused';
  improvement?: string;
  createdAt: number;
}

export interface LeaderAction {
  id?: string;
  leaderId: string;
  userId: string;
  type: 'congratulate' | 'wait' | 'attention' | 'other';
  note?: string;
  createdAt: number;
}

export interface PointHistory {
  id?: string;
  userId: string;
  areaId?: string;
  points: number;
  change: number;
  reason: string;
  createdAt: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
}

export interface Role {
  id?: string;
  name: string;
  permissions: string[];
  createdAt: number;
}

export interface Area {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  countryIds?: string[];
}

export interface Trail {
  id?: string;
  areaIds: string[];
  countryIds?: string[];
  title: string;
  description: string;
  order: number;
  isActive: boolean;
  isMandatory?: boolean;
  isPublic?: boolean;
  imageUrl?: string;
  deadline?: string;
  isSlowTraining?: boolean;
  isOnboardingTrail?: boolean;
  onboardingJourney?: 'standard' | 'eir' | 'custom';
}

export interface QuizQuestion {
  questionText: string;
  questionText_en?: string;
  questionText_es?: string;
  options: string[];
  options_en?: string[];
  options_es?: string[];
  correctOptionIndex: number;
}

export interface Module {
  id?: string;
  trailId?: string;
  projectId?: string;
  title: string;
  description: string;
  type: 'video' | 'document' | 'activity' | 'quiz';
  videoEmbedUrl?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentType?: 'pdf' | 'doc' | 'xls' | 'ppt' | 'image' | 'link' | 'slides' | 'sheets';
  activityConfig?: {
    instructions: string;
    requiredFileType?: string;
    maxFileSizeMB?: number;
  };
  materials: { title: string; url: string }[];
  order: number;
  quizConfig: {
    passingScore: number;
    isRequired: boolean;
  };
  questions: QuizQuestion[];
  imageUrl?: string;
  duration?: number; // Estimated duration in seconds
}

export interface UserProgress {
  id?: string; // userId_moduleId
  userId: string;
  areaId?: string | null;
  trailId?: string;
  projectId?: string;
  moduleId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  videoPercentage: number;
  lastTimeSeconds?: number;
  timeSpentSeconds: number;
  highestQuizScore: number;
  quizAttempts?: number;
  activitySubmission?: {
    url: string;
    fileName: string;
    submittedAt: number;
    status: 'pending' | 'approved' | 'rejected';
    feedback?: string;
  };
  pointsAwarded?: {
    video?: boolean;
    quiz?: boolean;
    module?: boolean;
    activity?: boolean;
  };
  timePointsAwarded?: number;
  lastUpdatedAt: number;
  enrolledAt?: number;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'new_trail' | 'new_module' | 'general';
  link?: string;
  isRead: boolean;
  createdAt: number;
}

export const AVAILABLE_PERMISSIONS = [
  { id: 'view_admin', label: 'Básico' },
  { id: 'view_analytics', label: 'Visualizar Dashboard Analytics' },
  { id: 'manage_users', label: 'Gerenciar Usuários' },
  { id: 'manage_roles', label: 'Gerenciar Perfis de Acesso' },
  { id: 'manage_learning', label: 'Gerenciar Áreas, Trilhas e Módulos' }
];

export interface PlaybookContent {
  id?: string;
  sessionId: string;
  title: string;
  type: 'pdf' | 'presentation' | 'link' | 'video';
  url: string;
  imageUrl?: string;
  description?: string;
  createdAt: number;
}

export interface PlaybookSession {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  order: number;
  isActive: boolean;
  createdAt: number;
}

export interface Comment {
  id?: string;
  moduleId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userLevel?: number;
  userBadges?: UserBadge[];
  text: string;
  createdAt: number;
  likes: string[];
  parentId?: string | null;
}

export interface TrailSurvey {
  id?: string;
  userId: string;
  trailId: string;
  rating: number;
  feedback?: string;
  createdAt: number;
}

export interface PlaybookAccessLog {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  contentId: string;
  contentTitle: string;
  sessionId: string;
  timestamp: number;
}

export interface Recognition {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  toUserCountry?: string;
  toUserCountryId?: string;
  reason: string;
  createdAt: number;
}

export interface EirHotspot {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  title: string;
  title_en?: string;
  title_es?: string;
  content: string;
  content_en?: string;
  content_es?: string;
  imageUrl?: string;
  linkUrl?: string;
}

export interface EirItem {
  id: string;
  type: 'image' | 'hotspot_image' | 'hotspot_link_image' | 'video' | 'quiz' | 'external_link' | 'drive_document';
  title: string;
  title_en?: string;
  title_es?: string;
  url?: string;
  linkUrl?: string;
  hotspots?: EirHotspot[];
  quizConfig?: {
    passingScore: number;
    questions: QuizQuestion[];
  };
}

export interface EirDay {
  id?: string;
  dayNumber: number;
  title: string;
  title_en?: string;
  title_es?: string;
  items: EirItem[];
}

export interface Project {
  id?: string;
  name: string;
  description: string;
  trailIds: string[];
  isActive: boolean;
  createdAt: number;
}
