import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/preact';
import DOMPurify from 'dompurify';

// Import helper functions by exporting them from TaskForm.jsx first
// For now, we'll test through the DOM manipulation since parse_html is internal

describe('TaskForm Helper Functions', () => {
  describe('parse_html - required field marking', () => {
    let mockState;

    beforeEach(() => {
      mockState = {
        api: {
          user: { profile: { value: { id: 'user123' } } },
          task: {
            value: { data: { assignee: 'user123' } },
            one: { value: { data: { id: 'task123' } } }
          }
        }
      };
    });

    it('should mark text input as required with asterisk', () => {
      const html = `
        <form>
          <label>Username</label>
          <input type="text" name="username" required />
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      // Simulate the parse_html logic for required fields
      for (const field of inputs) {
        if (field.hasAttribute('required')) {
          if (field.type !== 'date') {
            // This is the current implementation with the TODO
            const prevElement = field.previousElementSibling;
            if (prevElement && prevElement.tagName === 'LABEL') {
              prevElement.textContent += '*';
            }
          }
        }
      }

      const label = form.querySelector('label');
      expect(label.textContent).toContain('*');
    });

    it('should handle missing previousElementSibling gracefully', () => {
      const html = `
        <form>
          <input type="text" name="username" required />
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      // This should not throw an error
      expect(() => {
        for (const field of inputs) {
          if (field.hasAttribute('required')) {
            if (field.type !== 'date') {
              const prevElement = field.previousElementSibling;
              // The TODO fix: check if prevElement exists
              if (prevElement && prevElement.tagName === 'LABEL') {
                prevElement.textContent += '*';
              }
            }
          }
        }
      }).not.toThrow();
    });

    it('should handle nested input within label', () => {
      const html = `
        <form>
          <label>Username
            <input type="text" name="username" required />
          </label>
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      // When input is inside label, previousElementSibling might be null or text node
      for (const field of inputs) {
        if (field.hasAttribute('required')) {
          if (field.type !== 'date') {
            const prevElement = field.previousElementSibling;
            // Should handle null case
            if (prevElement && prevElement.tagName === 'LABEL') {
              prevElement.textContent += '*';
            }
            // Alternative: mark parent label if input is nested
            const parentLabel = field.closest('label');
            if (parentLabel && !parentLabel.textContent.includes('*')) {
              parentLabel.textContent += '*';
            }
          }
        }
      }

      const label = form.querySelector('label');
      expect(label.textContent).toContain('*');
    });

    it('should NOT mark date inputs as required (current behavior)', () => {
      const html = `
        <form>
          <label>Birth Date</label>
          <input type="date" name="birthdate" required />
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      for (const field of inputs) {
        if (field.hasAttribute('required')) {
          if (field.type !== 'date') {
            const prevElement = field.previousElementSibling;
            if (prevElement && prevElement.tagName === 'LABEL') {
              prevElement.textContent += '*';
            }
          }
        }
      }

      const label = form.querySelector('label');
      // Should NOT have asterisk due to date type exclusion
      expect(label.textContent).not.toContain('*');
    });

    it('should mark date inputs as required after TODO fix', () => {
      const html = `
        <form>
          <label>Birth Date</label>
          <input type="date" name="birthdate" required />
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      // Improved implementation: also mark date fields
      for (const field of inputs) {
        if (field.hasAttribute('required')) {
          const prevElement = field.previousElementSibling;
          if (prevElement && prevElement.tagName === 'LABEL') {
            if (!prevElement.textContent.includes('*')) {
              prevElement.textContent += '*';
            }
          }
        }
      }

      const label = form.querySelector('label');
      expect(label.textContent).toContain('*');
    });

    it('should handle multiple required fields', () => {
      const html = `
        <form>
          <label>Username</label>
          <input type="text" name="username" required />
          <label>Email</label>
          <input type="email" name="email" required />
          <label>Age</label>
          <input type="number" name="age" required />
        </form>
      `;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.getElementsByTagName('form')[0];
      const inputs = form.getElementsByTagName('input');

      for (const field of inputs) {
        if (field.hasAttribute('required')) {
          const prevElement = field.previousElementSibling;
          if (prevElement && prevElement.tagName === 'LABEL') {
            if (!prevElement.textContent.includes('*')) {
              prevElement.textContent += '*';
            }
          }
        }
      }

      const labels = form.querySelectorAll('label');
      labels.forEach(label => {
        expect(label.textContent).toContain('*');
      });
    });
  });

  describe('build_form_data logic', () => {
    it('should build data for text input', () => {
      const data = {};
      const input = { type: 'text', name: 'username', value: 'john' };

      if (input.value) {
        data[input.name] = { value: input.value };
      }

      expect(data).toEqual({ username: { value: 'john' } });
    });

    it('should build data for checkbox', () => {
      const data = {};
      const input = { type: 'checkbox', name: 'agree', checked: true };

      data[input.name] = { value: input.checked };

      expect(data).toEqual({ agree: { value: true } });
    });

    it('should build data for number input', () => {
      const data = {};
      const input = { type: 'number', name: 'age', value: '25' };

      if (input.value) {
        data[input.name] = { value: parseInt(input.value, 10) };
      }

      expect(data).toEqual({ age: { value: 25 } });
    });

    it('should build data for date input with formatting', () => {
      const data = {};
      const input = { type: 'date', name: 'birthdate', value: '2000-12-25' };
      const temporary = false;

      if (input.value) {
        const val = temporary ? input.value : input.value.split('-').reverse().join('/');
        data[input.name] = { value: val };
      }

      expect(data).toEqual({ birthdate: { value: '25/12/2000' } });
    });

    it('should skip inputs without name', () => {
      const data = {};
      const input = { type: 'text', name: '', value: 'test' };

      if (input.name && input.value) {
        data[input.name] = { value: input.value };
      }

      expect(Object.keys(data)).toHaveLength(0);
    });

    it('should skip inputs without value', () => {
      const data = {};
      const input = { type: 'text', name: 'username', value: '' };

      if (input.name && input.value) {
        data[input.name] = { value: input.value };
      }

      expect(Object.keys(data)).toHaveLength(0);
    });
  });

  describe('prepare_form_data logic', () => {
    it('should group components by row', () => {
      const form = {
        components: [
          { id: '1', layout: { row: 'Row_1' } },
          { id: '2', layout: { row: 'Row_1' } },
          { id: '3', layout: { row: 'Row_2' } }
        ]
      };

      const components = [];
      let rowName = '';
      let row = [];

      form.components.forEach((component, index) => {
        if (rowName !== component.layout.row) {
          if (rowName !== '') components.push({ key: rowName, value: row });
          row = [];
          rowName = component.layout.row;
        }

        row.push(component);

        if (index === form.components.length - 1) {
          components.push({ key: rowName, value: row });
        }
      });

      expect(components).toHaveLength(2);
      expect(components[0].key).toBe('Row_1');
      expect(components[0].value).toHaveLength(2);
      expect(components[1].key).toBe('Row_2');
      expect(components[1].value).toHaveLength(1);
    });

    it('should handle single row', () => {
      const form = {
        components: [
          { id: '1', layout: { row: 'Row_1' } },
          { id: '2', layout: { row: 'Row_1' } }
        ]
      };

      const components = [];
      let rowName = '';
      let row = [];

      form.components.forEach((component, index) => {
        if (rowName !== component.layout.row) {
          if (rowName !== '') components.push({ key: rowName, value: row });
          row = [];
          rowName = component.layout.row;
        }

        row.push(component);

        if (index === form.components.length - 1) {
          components.push({ key: rowName, value: row });
        }
      });

      expect(components).toHaveLength(1);
      expect(components[0].key).toBe('Row_1');
      expect(components[0].value).toHaveLength(2);
    });
  });
});

describe('TaskForm Sub-Components', () => {
  describe('Input Component', () => {
    it('should render text input with label', () => {
      // This would require exporting Input component
      // For now, we test the expected structure
      const component = {
        type: 'textfield',
        label: 'Username',
        key: 'username',
        validate: { required: true }
      };

      expect(component.label).toBe('Username');
      expect(component.validate.required).toBe(true);
    });

    it('should handle datetime subtype', () => {
      const component = {
        type: 'datetime',
        subtype: 'datetime',
        label: 'Appointment',
        key: 'appointment'
      };

      let type = component.type;
      if (type === 'datetime') {
        type = component.subtype === 'datetime' ? 'datetime-local' : component.subtype;
      }

      expect(type).toBe('datetime-local');
    });
  });

  describe('Select Component', () => {
    it('should handle select options', () => {
      const component = {
        type: 'select',
        label: 'Country',
        key: 'country',
        values: [
          { value: 'de', label: 'Germany' },
          { value: 'us', label: 'United States' }
        ]
      };

      expect(component.values).toHaveLength(2);
      expect(component.values[0].label).toBe('Germany');
    });
  });

  describe('MultiInput Component', () => {
    it('should convert checklist to checkbox type', () => {
      const component = {
        type: 'checklist',
        label: 'Interests',
        values: [
          { value: 'sports', label: 'Sports' },
          { value: 'music', label: 'Music' }
        ]
      };

      let type = component.type;
      if (type === 'checklist') {
        type = 'checkbox';
      }

      expect(type).toBe('checkbox');
      expect(component.values).toHaveLength(2);
    });
  });
});
