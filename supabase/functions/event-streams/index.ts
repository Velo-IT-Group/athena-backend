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
			schema: 'reporting',
		},
    },
  )
  const response = await req.json()
  
  response.forEach(({ type, data }: { type: EventType; data: any }) => {
		const payload: TaskRouterPayload = data.payload;
		const parameters: VoiceParameters = data.request?.parameters;
		const attributes = payload ? JSON.parse(payload.task_attributes) : {};

		if (payload && payload.workflow_name !== 'Voicemail') {
			console.log(payload);
		}

		switch (type) {
			case 'com.twilio.taskrouter.reservation.wrapup':
				const timestamp = new Date(payload.timestamp);
				const dateCreated = new Date(payload.task_date_created);
				const duration = Math.floor((timestamp.getTime() - dateCreated.getTime()) / 1000);
				supabase
					.from('conversations')
					.update({
						talk_time: duration,
					})
					.eq('id', attributes.direction === 'outbound' ? payload.task_sid : attributes.call_sid)
					.then(({data, error}) => {
						if (error) {
							console.error(error)
						} else {
							console.log(data);
						}
					});
				break;
			case 'com.twilio.taskrouter.task.canceled':
				supabase
					.from('conversations')
					.update({
						abandoned: 'Yes',
						abandoned_phase: attributes.conversations?.abandoned_phase || 'Queue',
						abandon_time: payload.task_age,
						outcome: payload.task_canceled_reason,
					})
					.eq('id', attributes.direction === 'outbound' ? payload.task_sid : attributes.call_sid)
					.then(({ data, error }) => {
						if (error) {
							console.error(error)
						} else {
							console.log(data);
						}
					});
				break;
			case 'com.twilio.taskrouter.task.created':
				supabase
					.from('conversations')
					.upsert({
						id: attributes.direction === 'outbound' ? payload.task_sid : attributes.call_sid,
						phone_number: attributes.from,
						direction: attributes.direction,
						date: new Date(payload.timestamp).toISOString(),
						communication_channel: payload.task_channel_unique_name,
						workflow: payload.workflow_name,
						in_business_hours: attributes.in_business_hours,
						contact_id: attributes.userId ? Number(attributes.userId) : null,
						company_id: attributes.companyId ? Number(attributes.companyId) : null,
					})
					.then(({ data, error }) => {
						if (error) {
							console.error(error)
						} else {
							console.log(data);
						}
					});
				break;
			case 'com.twilio.taskrouter.reservation.accepted':
				const isAbandoned =
					attributes.conversations?.abandoned ||
					(payload.task_assignment_status === 'canceled' && payload.task_canceled_reason === 'hangup');

				supabase
					.from('conversations')
					.update({
						agent: payload.worker_sid,
						queue: payload.task_queue_name,
					})
					.eq('id', attributes.direction === 'outbound' ? payload.task_sid : attributes.call_sid)
					.then(({ data, error }) => {
						if (error) {
							console.error(error)
						} else {
							console.log(data);
						}
					});
				break;
			case 'com.twilio.voice.twiml.enqueue.finished':
				supabase
					.from('conversations')
					.upsert({
						id: parameters.CallSid,
						queue_time: Number(parameters.QueueTime),
					})
					.then(({ data, error }) => {
						if (error) {
							console.error(error)
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
