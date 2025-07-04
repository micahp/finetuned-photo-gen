// Common interfaces
export interface DemoItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  title?: string;
  category?: string;
  tags?: string[];
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  title?: string;
  category?: string;
  creditCost?: {
    recreate: number;
    remix: number;
    upscale: number;
    makeVideo: number;
  };
}

// Component Props
export interface HeroCarouselProps {
  videos?: Array<{
    id: string;
    url: string;
    thumbnail: string;
    title?: string;
  }>;
  autoplayInterval?: number;
  className?: string;
}

export interface StickyHeaderProps {
  className?: string;
  isAuthenticated?: boolean;
}

export interface DemoGridProps {
  items?: DemoItem[];
  columns?: number;
  onItemClick?: (item: DemoItem) => void;
  className?: string;
  filters?: string[];
}

export interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediaItem | null;
  items?: MediaItem[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onAction?: (action: string, item: MediaItem) => void;
}

export interface FloatingFooterProps {
  className?: string;
  creator?: {
    name: string;
    avatar?: string;
    url?: string;
  };
  showFeedback?: boolean;
}

export interface CreditPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim?: () => void;
  credits?: number;
  timeDelayMs?: number;
  enableExitIntent?: boolean;
} 