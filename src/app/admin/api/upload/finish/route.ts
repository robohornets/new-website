// On the deployed Worker, worker.ts answers this itself (src/lib/upload.ts).
// Under `next dev` there's no real R2 to upload to directly, so this says
// "not available" and the browser sends the file through the Worker instead.
export function POST() {
  return Response.json({ direct: false }, { status: 501 });
}
