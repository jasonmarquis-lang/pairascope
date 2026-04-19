// ─── Chat & Conversation ───────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt?: Date
}

export interface Conversation {
  id: string
  userId?: string
  createdAt: Date
  messages: Message[]
}

// ─── Project Snapshot ──────────────────────────────────────────────────────
// Extracted by AI from the conversation — this is the structured data

export type ConfidenceLevel = 'red' | 'yellow' | 'green'

export interface ProjectSnapshot {
  projectType?: string
  material?: string
  scale?: string
  location?: string
  services?: string[]
  missingInfo?: string[]
  budgetRange?: string
  timeline?: string
  confidenceLevel: ConfidenceLevel
  confidenceScore: number // 0–100
  aiSummary?: string
}

// ─── Vendor ────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string
  name: string
  primaryService: string
  contactName: string
  email: string
  phone?: string
  location?: string
  capabilities: string
  materials?: string
  shortBio: string
  website?: string
  rating?: number
  active: boolean
}

// ─── RFQ ───────────────────────────────────────────────────────────────────

export type RFQStatus = 'Draft' | 'Sent' | 'Responses In' | 'Closed'

export interface RFQ {
  id: string
  title: string
  linkedProjectId: string
  scopeDocument: string
  dateIssued: string
  responseDeadline?: string
  status: RFQStatus
  artistNotified: boolean
  bidResponses?: string[]
}

// ─── API Response shapes ───────────────────────────────────────────────────

export interface ChatApiResponse {
  reply: string
  snapshot: ProjectSnapshot
  conversationId: string
  messageId: string
}

export interface SaveProjectResponse {
  success: boolean
  airtableRecordId?: string
  error?: string
}
