export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'className') node.className = value;
    else if (name === 'text') node.textContent = value;
    else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2).toLowerCase(), value);
    else if (['disabled', 'required', 'hidden'].includes(name)) node[name] = Boolean(value);
    else if (value !== undefined && value !== null) node.setAttribute(name, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node) node.append(child);
    else if (child !== undefined && child !== null) node.append(document.createTextNode(String(child)));
  }
  return node;
}

export function formatPrice(cents) { return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(cents / 100)}`; }
export function formatDate(value) { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
