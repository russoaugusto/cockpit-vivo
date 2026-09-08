// Replica a API window.storage do ambiente Claude usando localStorage
window.storage = {
  async get(key, _secret = false) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    } catch (e) {
      return null;
    }
  },
  async set(key, value, _secret = false) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },
};