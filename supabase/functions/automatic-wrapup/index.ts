// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
		db: {
			schema: 'taskrouter',
		},
    },
  )
	const response = await req.json()
	  
  response.forEach(({ type, data }: { type: EventType; data: any }) => {
		const payload: TaskRouterPayload = data.payload;
		const parameters: VoiceParameters = data.request?.parameters;
		const attributes = payload ? JSON.parse(payload.task_attributes) : {};

		switch (type) {
			case 'com.twilio.taskrouter.reservation.wrapup':
				supabase
					.from('tasks')
					.insert({
						task_sid: payload.task_sid,
						reservation_sid: payload.reservation_sid,
					})
					.then(({data, error}) => {
						if (error) {
							console.error('com.twilio.taskrouter.reservation.wrapup: ', error, payload)
						} else {
							console.log(data);
						}
					});
				break;
			default:
				console.log('UNKNOWN EVENT', data, type);
				break;
		}
	});

  return new Response(
    JSON.stringify({ status: 200 }),
    { headers: { "Content-Type": "application/json" } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/event-streams' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
