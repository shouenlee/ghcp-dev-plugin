/**
 * ghcp-dev-plugin for OpenCode
 *
 * Auto-registers all plugin skill directories so OpenCode discovers
 * every skill from the plugins/ folder without duplicating files.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(__dirname, '../../plugins');

export const GhcpDevPlugin = async ({ client, directory }) => {
  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];

      for (const pluginName of fs.readdirSync(pluginsDir).sort()) {
        const skillsDir = path.join(pluginsDir, pluginName, 'skills');
        if (fs.existsSync(skillsDir) && !config.skills.paths.includes(skillsDir)) {
          config.skills.paths.push(skillsDir);
        }
      }
    }
  };
};
