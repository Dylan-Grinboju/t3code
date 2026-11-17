# Persistent bots

Create a thread with the provider and project you want, then choose **Make this a bot**. Set its standing objective, the path to its skill, and the path to its durable work state on the machine that runs it. Rename the thread to name the bot. Both Claude and Codex continue using the authentication already configured in T3.

The quiet conversation shows replies, decisions, and worker links. **Activity** restores the full timeline, including tool calls and progress. **History** shows older quiet exchanges. Citations, the browser, and normal thread shortcuts work as before. Bots stay available after a turn finishes. Their background subagents do not automatically open tabs; you can open them from the conversation when you need to inspect their work.

A bot should save decisions and next actions in its work tracker before yielding. By default, after 12 completed interactive turns, the next idle turn starts with fresh model context and reloads the skill and tracker. This does not delete conversation history. An interrupted run is not a completed turn. Scheduled fresh sessions do not count toward the interactive limit.

For proactive checks, use the thread's **Automations** and select a fresh session. Bot settings alone do not create or enable a schedule. Keep an existing host's routine paused while moving it here. Import its tracker and verify a manual check before enabling the new schedule.

Use **Use normal thread** in bot settings to remove the standing objective and quiet presentation. Existing schedules are independent: pause or remove them in Automations if you also want background checks to stop. The conversation and work tracker are retained.
