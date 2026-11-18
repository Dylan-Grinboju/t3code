# Persistent bots

Create a thread with the provider and project you want, then choose **Make this a bot**, or ask an agent to make a thread a bot for you. Set its standing objective, the path to its skill, and the path to its durable work state on the machine that runs it. Rename the thread to name the bot. Both Claude and Codex continue using the authentication already configured in T3.

Bots appear in a dedicated section above task threads, with their live status. The section stays available across project filters; archived and hidden bots stay hidden. The bot header shows its objective and whether it needs your input.

The quiet conversation shows replies, decisions, and work links. **Activity** restores the full timeline, including tool calls and progress. **History** shows older loaded exchanges. Citations and the browser use the normal T3 controls. **Work** lists conversations created by the bot in loaded history and opens the existing worker inspector. Work conversations are ordinary T3 threads you can talk in. Background workers stay under their parent and do not automatically open tabs. The portable work tracker remains the complete backlog; this view does not replace it.

A bot reads its skill once per session and reaches its work state the way the skill describes, so an edit to the skill takes effect at the next fresh session. **Reload skill** in bot settings starts one with your next message. Anything that must outlast the conversation belongs in the work state. By default, after 12 completed interactive turns, the next idle turn starts with fresh model context and reads the skill again. This does not delete conversation history. An interrupted run is not a completed turn. Scheduled fresh sessions do not count toward the interactive limit.

For proactive checks, use the thread's **Automations** and select a fresh session. Bot settings alone do not create or enable a schedule. Keep an existing host's routine paused while moving it here. Import its tracker and verify a manual check before enabling the new schedule.

Use **Use normal thread** in bot settings to remove the standing objective and quiet presentation and return it to the ordinary thread list. Existing schedules are independent: pause or remove them in Automations if you also want background checks to stop. The conversation and work tracker are retained.
