export function publicCors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

export function publicOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
