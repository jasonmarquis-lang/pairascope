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

export type ConfidenceLevel = 'red' | 'yellow' | 'green'

export type ServiceTrack =
  | 'fabrication'
  | 'shipping'
  | 'installation'
  | 'conservation'
  | 'design_assist'

export interface ProjectSnapshot {
  projectType?:             string
  serviceTrack?:            ServiceTrack
  material?:                string
  scale?:                   string
  location?:                string
  services?:                string[]
  missingInfo?:             string[]
  budgetRange?:             string
  timeline?:                string
  finish?:                  string
  structuralRequirements?:  string
  siteConditions?:          string
  confidenceLevel:          ConfidenceLevel
  confidenceScore:          number
  aiSummary?:               string
}

// ─── RFQ ───────────────────────────────────────────────────────────────────

export type RFQStatus = 'Draft' | 'Sent' | 'Responses In' | 'Closed'

export interface RFQ {
  id:               string
  title:            string
  linkedProjectId:  string
  scopeDocument:    string
  dateIssued:       string
  responseDeadline?: string
  status:           RFQStatus
  artistNotified:   boolean
  bidResponses?:    string[]
}

// ─── Vendor ────────────────────────────────────────────────────────────────

export interface Vendor {
  id:             string
  name:           string
  primaryService: string
  contactName:    string
  email:          string
  phone?:         string
  location?:      string
  capabilities:   string
  materials?:     string
  shortBio:       string
  website?:       string
  rating?:        number
  active:         boolean
}

// ─── Bid / Response ────────────────────────────────────────────────────────

export interface Bid {
  id:            string
  rfqId:         string
  vendorId:      string
  vendorName:    string
  priceRangeLow?: number
  priceRangeHigh?: number
  timeline?:     string
  assumptions?:  string
  notes?:        string
  status:        'Under Review' | 'Shortlisted' | 'Selected' | 'Declined'
  dateReceived:  string
}

// ─── API Response shapes ───────────────────────────────────────────────────

export interface ChatApiResponse {
  reply:          string
  snapshot:       ProjectSnapshot
  conversationId: string
  messageId:      string
}

export interface SaveProjectResponse {
  success:           boolean
  airtableRecordId?: string
  error?:            string
}
