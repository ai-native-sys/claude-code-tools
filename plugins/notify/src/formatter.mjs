import { basename } from 'node:path';
import { hostname } from 'node:os';

const STATUS_CONFIG = {
  task_complete: {
    emoji: '\u2705',
    title: 'Task Complete',
    level: 'success',
  },
  review_complete: {
    emoji: '\ud83d\udcda',
    title: 'Review Complete',
    level: 'success',
  },
  question: {
    emoji: '\u2753',
    title: 'Needs Input',
    level: 'action',
  },
  permission: {
    emoji: '\ud83d\udd10',
    title: 'Needs Permission',
    level: 'action',
  },
  plan_ready: {
    emoji: '\ud83d\udccb',
    title: 'Plan Ready',
    level: 'action',
  },
  api_error: {
    emoji: '\u26a0\ufe0f',
    title: 'API Error',
    level: 'warning',
  },
  session_limit: {
    emoji: '\u26a0\ufe0f',
    title: 'Session Limit',
    level: 'warning',
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
  const cleaned = text.replace(/[^\S\n]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + '...';
}

function formatPermissionMessage(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  let detail = '';

  if (toolName === 'Bash' || toolName === 'bash') {
    detail = toolInput.command ? truncate(toolInput.command, 150) : '';
  } else if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Read') {
    detail = toolInput.file_path || '';
  } else if (toolName === 'Glob') {
    detail = toolInput.pattern || '';
  } else if (toolName === 'Grep') {
    detail = toolInput.pattern || '';
  }

  const lines = [];
  if (toolName) lines.push(`Tool: ${toolName}`);
  if (detail) lines.push(detail);
  if (!toolName && input.notification_message) {
    lines.push(truncate(input.notification_message, 200));
  }
  return lines.join('\n') || 'Claude needs permission to proceed';
}

function formatQuestionMessage(input) {
  const toolInput = input.tool_input || {};
  const questions = toolInput.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return truncate(getLastAssistantMessage(input)) || 'Claude needs your input';
  }

  const lines = [];
  for (const q of questions) {
    if (q.question) lines.push(q.question);
    const opts = q.options || [];
    for (const opt of opts) {
      if (opt.label) lines.push(`  - ${opt.label}`);
    }
  }
  return truncate(lines.join('\n'), 500);
}

function formatPlanMessage(input) {
  const summary = truncate(getLastAssistantMessage(input), 300);
  return summary || 'Plan is ready for your review';
}

function getMessage(status, input) {
  switch (status) {
    case 'plan_ready':
      return formatPlanMessage(input);
    case 'session_limit':
      return 'Session limit reached';
    case 'api_error':
      return truncate(getLastAssistantMessage(input)) || 'API error occurred';
    case 'permission':
      return formatPermissionMessage(input);
    case 'question':
      return formatQuestionMessage(input);
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
