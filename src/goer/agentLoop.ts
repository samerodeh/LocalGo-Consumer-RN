import { MAX_TURNS } from './config';
import { systemPromptFor } from './agents';
import { toolsForAgent } from './tools/schemas';
import { executeTool } from './tools/executors';
import { streamGoerChat, type StreamResult } from './streamClient';
import { goerMsg, useGoerStore } from './goerStore';
import { runFallbackTurn } from './localNLU';
import type { ApiToolResultBlock, GoerAgentId } from './types';

/**
 * The streaming agent loop: send the active agent's system prompt + shared
 * history, stream the reply, execute any tool_use blocks locally against the
 * zustand stores, feed tool_results back, and repeat until the model stops or
 * MAX_TURNS is hit. Handoffs swap the active agent between iterations. On
 * transport failure it downgrades — visibly but gracefully — to the offline
 * rule-based assistant and replays the same user input.
 */
export async function runGoerTurn(userText: string): Promise<void> {
  const appendText = (agent: GoerAgentId, text: string) => {
    if (text.trim().length === 0) return;
    useGoerStore.getState().appendMessage(goerMsg({ kind: 'text', role: 'assistant', agent, text }));
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const state = useGoerStore.getState();
    const agent = state.activeAgent;

    let result: StreamResult | null = null;
    // One transparent retry, but only if nothing streamed to the UI yet.
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      useGoerStore.getState().setStreamingText('');
      try {
        result = await streamGoerChat(
          {
            system: systemPromptFor(agent),
            messages: useGoerStore.getState().apiMessages,
            tools: toolsForAgent(agent),
          },
          (delta) => {
            const s = useGoerStore.getState();
            s.setStreamingText(s.streamingText + delta);
          },
        );
      } catch (err) {
        console.warn(`[goer] stream attempt ${attempt + 1} failed:`, err);
        const streamed = useGoerStore.getState().streamingText.length > 0;
        if (attempt === 1 || streamed) {
          // Downgrade for the rest of the session; the fallback NLU answers
          // this same input so the user never hits a dead end.
          const store = useGoerStore.getState();
          store.setStreamingText('');
          store.setMode('fallback');
          store.appendMessage(
            goerMsg({ kind: 'system_note', text: 'Connection hiccup — switched to the offline assistant.' }),
          );
          await runFallbackTurn(userText);
          return;
        }
      }
    }
    if (!result) return;

    // Finalize this iteration's streamed text into a real bubble.
    const textOut = result.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');
    useGoerStore.getState().setStreamingText('');
    appendText(agent, textOut);

    if (result.content.length > 0) {
      useGoerStore.getState().appendApiMessage({ role: 'assistant', content: result.content });
    }

    if (result.stopReason !== 'tool_use') return;

    const toolUses = result.content.filter((b) => b.type === 'tool_use');
    const toolResults: ApiToolResultBlock[] = [];
    let handoffTo: GoerAgentId | null = null;

    for (const block of toolUses) {
      if (block.type !== 'tool_use') continue;
      const execution = await executeTool(block.name, block.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: execution.resultText,
        ...(execution.isError ? { is_error: true } : {}),
      });
      for (const widget of execution.widgets ?? []) {
        useGoerStore.getState().appendMessage(widget);
      }
      if (execution.handoffTo) handoffTo = execution.handoffTo;
    }

    // All tool_results must ship in ONE user message (parallel tool use rule).
    useGoerStore.getState().appendApiMessage({ role: 'user', content: toolResults });

    if (handoffTo) useGoerStore.getState().setActiveAgent(handoffTo, true);
  }

  // MAX_TURNS exhausted — bail out honestly instead of looping forever.
  useGoerStore.getState().appendMessage(
    goerMsg({
      kind: 'text',
      role: 'assistant',
      agent: useGoerStore.getState().activeAgent,
      text: "I got a bit tangled up there — mind rephrasing that, or taking it one step at a time?",
    }),
  );
}
