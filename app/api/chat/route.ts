import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase'
import { createProjectRecord, getKnowledgeHubByService, logError } from '@/lib/airtable'
import { sendAdminErrorEmail } from '@/lib/email'
import { buildSystemPrompt, buildExtractionPrompt } from '@/lib/prompt'
import type { Message, ProjectSnapshot } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── Parse form data ────────────────────────────────────────────────
        const formData      = await req.formData()
        const messagesRaw   = formData.get('messages') as string
        const conversationId = (formData.get('conversationId') as string) || uuidv4()
        const file          = formData.get('file') as File | null

        const messages: Message[] = JSON.parse(messagesRaw)
        const latestUserMessage   = messages[messages.length - 1]

        if (!latestUserMessage?.content?.trim() && !file) {
          send({ type: 'text', text: "Could you tell me a bit more about your project? I'd love to help you define it." })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // ── Send conversation ID back to client ────────────────────────────
        send({ type: 'conversationId', conversationId })

        // ── Build knowledge hub context ────────────────────────────────────
        // Best-effort — don't block if it fails
        let knowledgeContext = ''
        try {
          const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
          // Simple heuristic: detect service type from conversation
          const lower = conversationText.toLowerCase()
          const serviceType =
            lower.includes('ship') || lower.includes('crat') ? 'Shipping' :
            lower.includes('install') || lower.includes('rig')  ? 'Installation' :
            lower.includes('conserv')                           ? 'Conservation' :
            lower.includes('design assist')                     ? 'Design Assist' :
                                                                  'Fabrication'

          const guides = await getKnowledgeHubByService(serviceType)
          if (guides.length > 0) {
            knowledgeContext = guides
              .map((g) => `### ${g.title}\n${g.scopeLanguage || ''}\n${g.standardAssumptions || ''}\n${g.riskLanguage || ''}`)
              .join('\n\n')
          }
        } catch { /* silently continue */ }

        // ── Build Anthropic messages array ─────────────────────────────────
        const anthropicMessages: Anthropic.MessageParam[] = []

        for (const msg of messages) {
          if (msg.role === 'user') {
            // If this is the last message and a file was attached, add as vision content
            const isLast = msg === latestUserMessage
            if (isLast && file) {
              const arrayBuffer = await file.arrayBuffer()
              const base64      = Buffer.from(arrayBuffer).toString('base64')
              const mediaType   = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

              if (mediaType.startsWith('image/')) {
                anthropicMessages.push({
                  role:    'user',
                  content: [
                    {
                      type:   'image',
                      source: { type: 'base64', media_type: mediaType, data: base64 },
                    },
                    { type: 'text', text: msg.content || 'I have attached a file for you to review.' },
                  ],
                })
              } else {
                // PDF or other doc — include as text note
                anthropicMessages.push({
                  role:    'user',
                  content: `${msg.content}\n\n[Note: User attached a file named "${file.name}". Please acknowledge it and ask relevant questions about the project based on what can be inferred from the filename and context.]`,
                })
              }
            } else {
              anthropicMessages.push({ role: 'user', content: msg.content })
            }
          } else {
            anthropicMessages.push({ role: 'assistant', content: msg.content })
          }
        }

        // ── Stream conversational response ─────────────────────────────────
        let fullReply = ''

        const streamResponse = await anthropic.messages.stream({
          model:      'claude-sonnet-4-5',
          max_tokens: 1024,
          system:     buildSystemPrompt(knowledgeContext),
          messages:   anthropicMessages,
        })

        for await (const chunk of streamResponse) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullReply += chunk.delta.text
            send({ type: 'text', text: chunk.delta.text })
          }
        }

        // ── Run extraction (parallel, non-blocking to stream) ──────────────
        const conversationText = [
          ...messages.map((m) => `${m.role}: ${m.content}`),
          `assistant: ${fullReply}`,
        ].join('\n')

        let snapshot: ProjectSnapshot = {
          confidenceLevel: 'red',
          confidenceScore: 0,
        }

        try {
          const extractionResponse = await anthropic.messages.create({
            model:      'claude-haiku-4-5',
            max_tokens: 512,
            messages: [{ role: 'user', content: buildExtractionPrompt(conversationText) }],
          })

          const raw     = extractionResponse.content[0].type === 'text' ? extractionResponse.content[0].text : '{}'
          const cleaned = raw.replace(/```json|```/g, '').trim()
          const parsed  = JSON.parse(cleaned)

          snapshot = {
            projectType:     parsed.projectType     || undefined,
            material:        parsed.material        || undefined,
            scale:           parsed.scale           || undefined,
            location:        parsed.location        || undefined,
            services:        parsed.services        || [],
            missingInfo:     parsed.missingInfo     || [],
            budgetRange:     parsed.budgetRange     || undefined,
            timeline:        parsed.timeline        || undefined,
            confidenceScore: parsed.confidenceScore || 0,
            confidenceLevel: parsed.confidenceLevel || 'red',
            aiSummary:       parsed.aiSummary       || undefined,
          }
        } catch (extractErr) {
          console.error('[Extraction] Failed to parse:', extractErr)
        }

        // Send snapshot to client
        send({ type: 'snapshot', snapshot })

        // ── Persist to Supabase ────────────────────────────────────────────
        try {
          // Upsert conversation
          await supabaseAdmin.from('conversations').upsert({
            id:         conversationId,
            updated_at: new Date().toISOString(),
          })

          // Insert user message
          await supabaseAdmin.from('messages').insert({
            id:              uuidv4(),
            conversation_id: conversationId,
            role:            'user',
            content:         latestUserMessage.content,
          })

          // Insert assistant message
          const assistantMsgId = uuidv4()
          await supabaseAdmin.from('messages').insert({
            id:              assistantMsgId,
            conversation_id: conversationId,
            role:            'assistant',
            content:         fullReply,
          })

          // Upsert project snapshot
          await supabaseAdmin.from('project_snapshots').upsert({
            conversation_id:  conversationId,
            project_type:     snapshot.projectType,
            material:         snapshot.material,
            scale:            snapshot.scale,
            location:         snapshot.location,
            services:         snapshot.services,
            missing_info:     snapshot.missingInfo,
            budget_range:     snapshot.budgetRange,
            timeline:         snapshot.timeline,
            confidence_level: snapshot.confidenceLevel,
            confidence_score: snapshot.confidenceScore,
            ai_summary:       snapshot.aiSummary,
            updated_at:       new Date().toISOString(),
          }, { onConflict: 'conversation_id' })

          // ── Sync summary to Airtable when threshold first reached ──────
          // Only push to Airtable when we have meaningful data (yellow or green)
          if (snapshot.confidenceLevel !== 'red' && latestUserMessage.content) {
            await createProjectRecord({
              inputText:      messages.filter((m) => m.role === "user").map((m) => m.content).join(" | "),
              snapshot,
              conversationId,
            })
          }
        } catch (dbErr) {
          console.error('[Supabase] Write failed:', dbErr)
          const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
          await logError('Supabase write failed', msg, 'High')
          await sendAdminErrorEmail('Supabase write failed', `Conversation: ${conversationId}\n\n${msg}`)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[Chat API] Unhandled error:', err)
        const msg = err instanceof Error ? err.message : String(err)

        try {
          await logError('Chat API failure', msg, 'Critical')
          await sendAdminErrorEmail('Chat API failure', msg)
        } catch { /* don't throw from error handler */ }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'text', text: "Something went wrong on our end. Please refresh and try again in a moment." })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
