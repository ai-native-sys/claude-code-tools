import { basename } from 'node:path';
import { hostname } from 'node:os';

const STATUS_CONFIG = {
  task_complete: {
    emoji: '\u2705',
    title: 'Task Complete',
    level: 'active',
  },
  review_complete: {
    emoji: '\ud83d\udcda',
    title: 'Review Complete',
    level: 'active',
  },
  question: {
    emoji: '\u2753',
    title: 'Needs Input',
    level: 'timeSensitive',
  },
  permission: {
    emoji: '\ud83d\udd10',
    title: 'Needs Permission',
    level: 'timeSensitive',
  },
  plan_ready: {
    emoji: '\ud83d\udccb',
    title: 'Plan Ready',
    level: 'timeSensitive',
  },
  api_error: {
    emoji: '\u26a0\ufe0f',
    title: 'API Error',
    level: 'active',
  },
  session_limit: {
    emoji: '\u26a0\ufe0f',
    title: 'Session Limit',
    level: 'active',
  },
};

function getProjectName(input) {
  const cwd = input.cwd || input.working_directory || '';
  return basename(cwd) || 'unknown';
}

function getLastAssistantMessage(input) {
  const transcript = input.transcript_summary || input.transcript || [];
  if (!Array.isArray(transcript)) return '';

  for (let i = transcript.length - 1; i >= 0; i--) {
    const msg = transcript[i];
    if (msg.role !== 'assistant') continue;
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (let j = content.length - 1; j >= 0; j--) {
      if (content[j].type === 'text' && content[j].text) {
        return content[j].text;
      }
    }
    if (typeof msg.content === 'string') return msg.content;
  }
  return '';
}

function truncate(text, maxLen = 200) {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + '...';
}

function getMessage(status, input) {
  switch (status) {
    case 'plan_ready':
      return 'Plan is ready for your review';
    case 'session_limit':
      return 'Session limit reached';
    case 'api_error':
      return truncate(getLastAssistantMessage(input)) || 'API error occurred';
    case 'permission': {
      if (input.notification_message) {
        return truncate(input.notification_message, 200);
      }
      return 'Claude needs permission to proceed';
    }
    case 'question': {
      const toolInput = input.tool_input || {};
      if (toolInput.questions && Array.isArray(toolInput.questions)) {
        const q = toolInput.questions[0];
        return truncate(q.question || '', 200);
      }
      return truncate(getLastAssistantMessage(input)) || 'Claude needs your input';
    }
    default:
      return truncate(getLastAssistantMessage(input)) || 'Claude has finished';
  }
}

export function formatNotification(status, input) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.task_complete;
  const projectName = getProjectName(input);
  const host = hostname();
  const message = getMessage(status, input);

  return {
    title: `${config.emoji} ${config.title}`,
    subtitle: `${projectName}@${host}`,
    body: message,
    group: `claude-code.${projectName}`,
    level: config.level,
  };
}
