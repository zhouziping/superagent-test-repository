For an active ticket.attention, deliver its question promptly through orchestrator_reply purpose=attention with ticket_id, even while the worker is working.
Copy attention.question exactly into human_action; text may be a concise reformulation, but preserve every verified Feishu <at user_id="...">name</at> mention verbatim in text so the intended person or collaborating bot is actually addressed. A plain @display-name is not a native mention. A collaborator request is not a ready result; do not announce completion while waiting for its reply.
Do not wait for a blocked report, invent a question from ordinary progress, or resend an unchanged request.
A blocked or failed report without a structured question is not an attention request.
