// =================== CORE TYPES ===================

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  folder_id?: number;
  user_id: number;
  folder_name?: string;
  tags?: string[];
}

export interface Folder {
  id: number;
  name: string;
  parent_id?: number;
  user_id: number;
  created_at: string;
}

// Workspace Stats
export interface WorkspaceStats {
  totalNotes: number;
  totalFolders: number;
  totalTags: number;
  notesThisWeek: number;
  notesThisMonth: number;
  totalWords: number;
  averageNotesPerDay: number;
}

// =================== TAG SYSTEM ===================

export interface Tag {
  name: string;
  count: number;
  notes: Array<{
    id: number;
    title: string;
  }>;
  fullPath?: string;
  children?: Record<string, Tag>;
}

export interface TagHierarchy {
  [key: string]: {
    name: string;
    fullPath: string;
    children: TagHierarchy;
    notes: Array<{
      id: number;
      title: string;
    }>;
    count: number;
  };
}

export interface TagsResponse {
  flat_tags: Tag[];
  hierarchical_tags: TagHierarchy;
  total_tags: number;
}

export interface TagAutocompleteResponse {
  suggestions: string[];
  query: string;
}

export interface PopularTagsResponse {
  popular_tags: Array<{
    name: string;
    count: number;
  }>;
}

// =================== GRAPH SYSTEM ===================

export interface GraphNode {
  id: number;
  title: string;
  content?: string;
  size: number;
  tags: string[];
  connections: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  color?: string;
  updated_at?: string;
  degree?: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  type: 'wiki-link' | 'tag' | 'mention';
  strength: number;
  tag?: string;
}

export interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  type: 'wiki-link' | 'mention' | 'tag-related';
  strength?: number;
  mentions?: number;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  links: GraphLink[];
}

export interface GraphConnectionsResponse {
  connections: GraphData;
  total_nodes: number;
  total_edges: number;
}

export interface GraphViewConfig {
  layout: 'force-directed' | 'hierarchical' | 'circular';
  showLabels: boolean;
  showIsolatedNodes: boolean;
  linkThickness: 'thin' | 'medium' | 'thick';
  nodeSize: 'small' | 'medium' | 'large';
  colorScheme: 'default' | 'dark' | 'light' | 'custom';
  physicsEnabled: boolean;
  linkDistance: number;
  repulsion: number;
  gravity: number;
  damping: number;
}

// =================== BACKLINKS SYSTEM ===================

export interface Backlink {
  note_id: number;
  title: string;
  context: string;
  link_text: string;
  created_at: string;
  updated_at: string;
  folder_id?: number;
  is_mention?: boolean;
}

export interface BacklinksResponse {
  note_id: number;
  note_title: string;
  backlinks: Backlink[];
  total_backlinks: number;
}

export interface Outlink {
  note_id?: number;
  title: string;
  exists: boolean;
  link_text: string;
  context: string;
}

export interface OutlinksResponse {
  note_id: number;
  note_title: string;
  outlinks: Outlink[];
  total_outlinks: number;
}

export interface BrokenLink {
  source_note_id: number;
  source_note_title: string;
  broken_link: string;
  link_display: string;
  context: string;
}

export interface BrokenLinksResponse {
  broken_links: BrokenLink[];
  total_broken: number;
}

export interface LinkSuggestion {
  note_id: number;
  title: string;
  snippet: string;
  updated_at: string;
  relevance: number;
}

export interface LinkSuggestionsResponse {
  query: string;
  suggestions: LinkSuggestion[];
}

// =================== SEARCH SYSTEM ===================

export interface SearchResult {
  id: number | string;
  title: string;
  type: 'note' | 'tag' | 'folder' | 'create';
  snippet?: string;
  updated_at?: string;
  folder_id?: number;
  parent_id?: number;
  tag?: string;
  score: number;
}

export interface GlobalSearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

// =================== CANVAS SYSTEM ===================

export interface CanvasNode {
  id: string;
  type: 'note' | 'text' | 'image' | 'link';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  data: {
    title?: string;
    content?: string;
    note_id?: number;
    url?: string;
    image_url?: string;
  };
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: 'default' | 'smooth' | 'step';
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

export interface CanvasBoard {
  id: number;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  created_at: string;
  updated_at: string;
  user_id: number;
}

// =================== COMMAND SYSTEM ===================

export interface Command {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'create' | 'edit' | 'view' | 'tools' | 'system';
  icon: React.ComponentType<any>;
  shortcut?: string;
  action: () => void;
}

// =================== COMPONENT PROPS ===================

export interface TagProps {
  tag: string;
  onRemove?: (tag: string) => void;
  onClick?: (tag: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'colored' | 'outline';
  showHierarchy?: boolean;
  className?: string;
}

export interface TagListProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  onTagRemove?: (tag: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'colored' | 'outline';
  showHierarchy?: boolean;
  maxVisible?: number;
  className?: string;
}

export interface TagInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onTagSelect?: (tag: string) => void;
  placeholder?: string;
  className?: string;
  showSuggestions?: boolean;
  allowCreation?: boolean;
}

export interface BacklinkPanelProps {
  noteId: number;
  noteTitle: string;
  className?: string;
}

export interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// =================== CONTEXT TYPES ===================

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isDark: boolean;
}

export interface NotificationContextType {
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// =================== API RESPONSES ===================

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  details?: any;
}

// =================== UTILITY TYPES ===================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  tags?: string[];
  folder_id?: number;
  date_from?: string;
  date_to?: string;
}

// =================== FORM TYPES ===================

export interface LoginFormData {
  username: string;
  password: string;
}

export interface NoteFormData {
  title: string;
  content: string;
  folder_id?: number;
}

export interface FolderFormData {
  name: string;
  parent_id?: number;
}