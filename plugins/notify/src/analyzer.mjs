import { debug } from './logger.mjs';

const WRITE_TOOLS = new Set([
  'Write', 'Edit', 'Bash', 'NotebookEdit', 'MultiEdit',
]);

const READ_ONLY_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoRead',
]);

const ERROR_PATTERNS = [/\b401\b/, /\b429\b/, /\b529\b/, /overloaded/i, /rate.?limit/i];
const SESSION_LIMIT_PATTERNS = [/session.?limit/i, /context.?limit/i, /conversation.?too.?long/i];

function getTranscriptText(input) {
  const transcript = input.transcript_summary || input.transcript || [];
  if (typeof transcript === 'string') return transcript;
  if (!Array.isArray(transcript)) return '';

  return transcript
    .map((msg) => {
      if (typeof msg === 'string') return msg;
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .map((block) => block.text || block.tool_name || '')
          .join(' ');
      }
      return '';
    })
    .join('\n');
}

function getToolsUsed(input) {
  const transcript = input.transcript_summary || input.transcript || [];
  if (!Array.isArray(transcript)) return [];

  const tools = [];
  for (const msg of transcript) {
    if (msg.role !== 'assistant') continue;
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const block of content) {
      if (block.type === 'tool_use' && block.name) {
        tools.push(block.name);
      } else if (block.tool_name) {
        tools.push(block.tool_name);
      }
    }
  }
  return tools;
}

function analyzeStopEvent(input) {
  const text = getTranscriptText(input);

  // Check for API errors
  if (ERROR_PATTERNS.some((p) => p.test(text))) {
    return 'api_error';
  }

  // Check for session limit
  if (SESSION_LIMIT_PATTERNS.some((p) => p.test(text))) {
    return 'session_limit';
  }

  const tools = getToolsUsed(input);
  const lastTool = tools.length > 0 ? tools[tools.length - 1] : null;

  // Check if last tool indicates specific status
  if (lastTool === 'ExitPlanMode') return 'plan_ready';
  if (lastTool === 'AskUserQuestion') return 'question';

  // Check if any write tools were used
  if (tools.some((t) => WRITE_TOOLS.has(t))) {
    return 'task_complete';
  }

  // Check if only read tools were used
  if (tools.length > 0 && tools.every((t) => READ_ONLY_TOOLS.has(t))) {
    return 'review_complete';
  }

  return 'task_complete';
}

export function analyzeHookInput(input) {
  const hookEvent = input.hook_event_name;
  const toolName = input.tool_name || '';

  if (hookEvent === 'PreToolUse') {
    if (toolName === 'ExitPlanMode') {
      debug(`analyze: PreToolUse/ExitPlanMode → plan_ready`);
      return { status: 'plan_ready', hookEvent };
    }
    if (toolName === 'AskUserQuestion') {
      debug(`analyze: PreToolUse/AskUserQuestion → question`);
      return { status: 'question', hookEvent };
    }
  }

  if (hookEvent === 'PermissionRequest') {
    debug(`analyze: PermissionRequest → permission`);
    return { status: 'permission', hookEvent };
  }

  if (hookEvent === 'Stop') {
    const status = analyzeStopEvent(input);
    debug(`analyze: Stop → ${status}`);
    return { status, hookEvent };
  }

  debug(`analyze: unmatched hookEvent=${hookEvent} → task_complete`);
  return { status: 'task_complete', hookEvent };
}
