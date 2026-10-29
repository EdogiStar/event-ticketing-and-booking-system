export class DomainError extends Error {
  constructor(code, message) {
    if (typeof code !== 'string' || code.trim() === '') {
      throw new TypeError('DomainError code must be a non-empty string');
    }
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
