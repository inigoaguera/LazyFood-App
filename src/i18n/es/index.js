// Diccionario por namespaces. Cada fichero exporta un objeto (puede anidar).
// La clave 'profile.section.account' se busca en profile.js → section.account.
import common from './common.js';
import domain from './domain.js';
import errors from './errors.js';
import ai from './ai.js';
import auth from './auth.js';
import household from './household.js';
import onboarding from './onboarding.js';
import home from './home.js';
import inventory from './inventory.js';
import scanner from './scanner.js';
import shopping from './shopping.js';
import recipes from './recipes.js';
import chat from './chat.js';
import menu from './menu.js';
import expenses from './expenses.js';
import profile from './profile.js';

export default {
  common, domain, errors, ai, auth, household, onboarding, home, inventory,
  scanner, shopping, recipes, chat, menu, expenses, profile,
};
