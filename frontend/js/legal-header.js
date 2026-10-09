import { getUser } from './auth.js';
import { renderHeader } from './header.js';
renderHeader(await getUser(false).catch(() => ({ name: 'Guest', role: 'guest' })));
