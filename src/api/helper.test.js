import { describe, it, expect } from 'vitest';
import { _url_server, _url_engine_rest, get_credentials, RESPONSE_STATE } from './helper.jsx';

describe('api/helper', () => {
  describe('URL builders', () => {
    it('should build server URL from state', () => {
      const state = {
        server: {
          value: {
            url: 'http://localhost:8080'
          }
        }
      };

      const result = _url_server(state);
      expect(result).toBe('http://localhost:8080');
    });

    it('should build engine REST URL from state', () => {
      const state = {
        server: {
          value: {
            url: 'http://localhost:8080'
          }
        }
      };

      const result = _url_engine_rest(state);
      expect(result).toBe('http://localhost:8080/engine-rest');
    });

    it('should handle different server URLs', () => {
      const state = {
        server: {
          value: {
            url: 'https://example.com:9090'
          }
        }
      };

      expect(_url_server(state)).toBe('https://example.com:9090');
      expect(_url_engine_rest(state)).toBe('https://example.com:9090/engine-rest');
    });

    it('should handle URLs without trailing slash', () => {
      const state = {
        server: {
          value: {
            url: 'http://127.0.0.1:5173'
          }
        }
      };

      expect(_url_engine_rest(state)).toBe('http://127.0.0.1:5173/engine-rest');
    });
  });

  describe('get_credentials', () => {
    it('should format credentials as username:password', () => {
      const state = {
        auth: {
          credentials: {
            username: 'demo',
            password: 'demo'
          }
        }
      };

      const result = get_credentials(state);
      expect(result).toBe('demo:demo');
    });

    it('should handle different credentials', () => {
      const state = {
        auth: {
          credentials: {
            username: 'admin',
            password: 'secret123'
          }
        }
      };

      const result = get_credentials(state);
      expect(result).toBe('admin:secret123');
    });

    it('should handle special characters in credentials', () => {
      const state = {
        auth: {
          credentials: {
            username: 'user@example.com',
            password: 'p@ssw0rd!'
          }
        }
      };

      const result = get_credentials(state);
      expect(result).toBe('user@example.com:p@ssw0rd!');
    });

    it('should handle empty credentials', () => {
      const state = {
        auth: {
          credentials: {
            username: '',
            password: ''
          }
        }
      };

      const result = get_credentials(state);
      expect(result).toBe(':');
    });
  });

  describe('RESPONSE_STATE constants', () => {
    it('should have NOT_INITIALIZED state', () => {
      expect(RESPONSE_STATE.NOT_INITIALIZED).toBe('NOT_INITIALIZED');
    });

    it('should have LOADING state', () => {
      expect(RESPONSE_STATE.LOADING).toBe('LOADING');
    });

    it('should have SUCCESS state', () => {
      expect(RESPONSE_STATE.SUCCESS).toBe('SUCCESS');
    });

    it('should have ERROR state', () => {
      expect(RESPONSE_STATE.ERROR).toBe('ERROR');
    });

    it('should have exactly 4 states', () => {
      const states = Object.keys(RESPONSE_STATE);
      expect(states).toHaveLength(4);
    });

    it('should have unique state values', () => {
      const values = Object.values(RESPONSE_STATE);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
});
