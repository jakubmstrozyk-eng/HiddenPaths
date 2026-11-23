/** An action or input that breaks the rules. `code` is stable for the app to translate. */
export class EngineError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
