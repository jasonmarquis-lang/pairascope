export const dynamic = "force-dynamic"
export async function POST() {
  return Response.json({ error: "Not configured" }, { status: 503 })
}
