function compilePath(path) {
  const names = [];
  const pattern = path.split('/').map((part) => {
    if (part.startsWith(':')) {
      names.push(part.slice(1));
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { names, regex: new RegExp(`^${pattern}/?$`) };
}

export function createRouter() {
  const routes = [];
  return {
    add(method, path, handler) {
      if (typeof handler !== 'function') throw new TypeError('Route handler must be a function');
      routes.push({ method: String(method).toUpperCase(), ...compilePath(path), handler });
      return this;
    },
    get(path, handler) { return this.add('GET', path, handler); },
    post(path, handler) { return this.add('POST', path, handler); },
    match(method, pathname) {
      const verb = String(method).toUpperCase();
      for (const route of routes) {
        if (route.method !== verb) continue;
        const match = route.regex.exec(pathname);
        if (!match) continue;
        const params = {};
        try {
          route.names.forEach((name, index) => { params[name] = decodeURIComponent(match[index + 1]); });
        } catch {
          return { handler: null, params: {}, badPathEncoding: true };
        }
        return { handler: route.handler, params };
      }
      return null;
    },
  };
}
