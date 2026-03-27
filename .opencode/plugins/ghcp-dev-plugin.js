/**
 * ghcp-dev-plugin for OpenCode
 *
 * - Registers all plugin skill directories via config.skills.paths
 * - Injects all agents from .opencode/agents/ via config.agent
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(__dirname, '../../plugins');
const agentsDir = path.resolve(__dirname, '../agents');

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: match[2].trim() };
};

export const GhcpDevPlugin = async ({ client, directory }) => {
  return {
    config: async (config) => {
      // Register skill paths
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      for (const pluginName of fs.readdirSync(pluginsDir).sort()) {
        const skillsDir = path.join(pluginsDir, pluginName, 'skills');
        if (fs.existsSync(skillsDir) && !config.skills.paths.includes(skillsDir)) {
          config.skills.paths.push(skillsDir);
        }
      }

      // Inject agents from .opencode/agents/
      config.agent = config.agent || {};
      for (const file of fs.readdirSync(agentsDir).sort()) {
        if (!file.endsWith('.md')) continue;
        const agentName = file.slice(0, -3);
        const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        config.agent[agentName] = {
          prompt: body,
          description: frontmatter.description || '',
          mode: frontmatter.mode || 'all',
          ...config.agent[agentName],
        };
      }
    }
  };
};
