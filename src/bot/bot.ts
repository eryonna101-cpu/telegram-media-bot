import { Bot, session, InlineKeyboard } from "grammy";
import { env } from "../config/env.js";
import { errorBoundary } from "./middleware/errors.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { registerStart } from "./handlers/start.js";
import { registerLinks } from "./handlers/links.js";
import { registerDownloads } from "./handlers/downloads.js";
import { registerStats } from "./handlers/stats.js";
import { registerAdmin } from "./handlers/admin.js";
import { logger } from "../utils/logger.js";

export const bot = new Bot<any>(env.BOT_TOKEN);

bot.use(
  session({
    initial: () => ({}),
  }),
);

bot.use(errorBoundary);
bot.use(authMiddleware);
bot.use(rateLimitMiddleware);

registerStart(bot);
registerAdmin(bot);
registerDownloads(bot);
registerStats(bot);
registerLinks(bot);

bot.catch((err) => {
  const e = err.error as Error;
  logger.error({ err: e.message, stack: e.stack });
});

export default bot;
