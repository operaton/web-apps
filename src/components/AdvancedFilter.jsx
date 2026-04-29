import { h } from 'preact';
import { useState, useEffect, useRef, useContext } from 'preact/hooks';
import { AppState } from '../state.js'; // 👈 Import your context
import '../css/components.css';
import engine_rest from "../api/engine_rest.jsx";
import * as Icons from '../assets/icons.jsx';
import { chevron_down, link_out } from "../assets/icons.jsx";

const AVAILABLE_FIELDS = ['Name', 'Key', 'State', 'Tenant ID'];
const AVAILABLE_OPERATORS = ['like', '=', '!='];

export function AdvancedFilter() {
  const state = useContext(AppState);

  const [activeFilters, setActiveFilters] = useState([]);
  const [currentStep, setCurrentStep] = useState('FIELD');
  const [draftFilter, setDraftFilter] = useState({ field: null, operator: null });
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // New state for the Saved Queries dropdown
  const [isSavedQueriesMenuOpen, setIsSavedQueriesMenuOpen] = useState(false);
  const [savedQueriesList, setSavedQueriesList] = useState([]);

  const inputRef = useRef(null);

  // Trigger backend request whenever activeFilters change
  useEffect(() => {
    if (!state) return;

    const params = new URLSearchParams();

    params.append('firstResult', '0');
    params.append('maxResults', '50');
    params.append('sortBy', 'name');
    params.append('sortOrder', 'asc');

    activeFilters.forEach(filter => {
      const { field, operator, value } = filter;
      if (!value) return;

      let apiKey = '';
      let apiValue = value;

      if (field === 'Name') {
        apiKey = operator === 'like' ? 'nameLike' : 'name';
        apiValue = operator === 'like' ? `%${value}%` : value;
      } else if (field === 'Key') {
        apiKey = operator === 'like' ? 'keyLike' : 'key';
        apiValue = operator === 'like' ? `%${value}%` : value;
      }

      if (apiKey) params.append(apiKey, apiValue);
    });

    const queryString = params.toString();

    console.log("Sending Request to Backend with URL query:", queryString);

    void engine_rest.process_definition.list(state, queryString);

  }, [activeFilters, state]);

  const saveToLocalStorage = () => {
    if (activeFilters.length === 0) {
      alert("Cannot save an empty query!");
      return;
    }

    let existingSaved = JSON.parse(localStorage.getItem('savedQueries') || '[]');

    // Migration: If the old format was just a single array of objects, wrap it
    if (existingSaved.length > 0 && !Array.isArray(existingSaved[0])) {
      existingSaved = [existingSaved];
    }

    // Prevent saving exact duplicates
    const newQueryStr = JSON.stringify(activeFilters);
    const isDuplicate = existingSaved.some(q => JSON.stringify(q) === newQueryStr);

    if (!isDuplicate) {
      existingSaved.push(activeFilters);
      localStorage.setItem('savedQueries', JSON.stringify(existingSaved));
      alert('Query saved to local storage!');
    } else {
      alert('This query is already saved!');
    }
  };

  const toggleSavedQueriesMenu = () => {
    if (!isSavedQueriesMenuOpen) {
      let saved = JSON.parse(localStorage.getItem('savedQueries') || '[]');
      if (saved.length > 0 && !Array.isArray(saved[0])) {
        saved = [saved]; // Migration catch for rendering
      }
      setSavedQueriesList(saved);
    }
    setIsSavedQueriesMenuOpen(!isSavedQueriesMenuOpen);
  };

  const applySavedQuery = (query) => {
    setActiveFilters(query);
    setIsSavedQueriesMenuOpen(false);
  };

  const resetInputState = () => {
    setCurrentStep('FIELD');
    setDraftFilter({ field: null, operator: null });
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const handleInputFocus = () => {
    if (currentStep !== 'VALUE') {
      setIsDropdownOpen(true);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.trim() === '') {
      resetInputState();
      setIsDropdownOpen(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && currentStep === 'VALUE') {
      const prefix = `${draftFilter.field} ${draftFilter.operator} `;
      if (inputValue.startsWith(prefix)) {
        const extractedValue = inputValue.substring(prefix.length).trim();

        if (extractedValue) {
          setActiveFilters([...activeFilters, { ...draftFilter, value: extractedValue }]);
          resetInputState();
        }
      }
    }

    if (e.key === 'Backspace' && inputValue === '') {
      if (activeFilters.length > 0 && currentStep === 'FIELD') {
        const newFilters = [...activeFilters];
        newFilters.pop();
        setActiveFilters(newFilters);
      }
    }
  };

  const handleOptionSelect = (option) => {
    if (currentStep === 'FIELD') {
      setDraftFilter({ field: option, operator: null });
      setCurrentStep('OPERATOR');
      setInputValue(`${option} `);
    } else if (currentStep === 'OPERATOR') {
      setDraftFilter(prev => ({ ...prev, operator: option }));
      setCurrentStep('VALUE');
      setInputValue(`${draftFilter.field} ${option} `);
      setIsDropdownOpen(false);
    }

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeFilter = (indexToRemove) => {
    setActiveFilters(activeFilters.filter((_, index) => index !== indexToRemove));
  };

  const dropdownOptions = currentStep === 'FIELD' ? AVAILABLE_FIELDS : AVAILABLE_OPERATORS;

  return (
    <div className="filter-bar">
      <div className="pills-container">
        {activeFilters.map((filter, index) => (
          <div key={index} className="filter-pill">
            <span className="remove-btn" onClick={() => removeFilter(index)}>×</span>
            {filter.field} {filter.operator} {filter.value}
          </div>
        ))}
      </div>

      <div className="input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          placeholder={activeFilters.length === 0 && currentStep === 'FIELD' ? "Add criteria" : ""}
          className={currentStep !== 'FIELD' && inputValue ? 'active-typing' : ''}
          onFocus={handleInputFocus}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          autocomplete="off"
        />

        {isDropdownOpen && (
          <ul className="dropdown-menu visible">
            {dropdownOptions.map(option => (
              <li
                key={option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleOptionSelect(option);
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="actions">
        <span className="count">{activeFilters.length}</span>
        <span className="action-btn" title="Copy Link"><Icons.link_out /></span>
        <span className="action-btn" onClick={saveToLocalStorage} title="Save Query"><Icons.save /></span>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span
            className="action-btn"
            title="Load Saved Query"
            onClick={toggleSavedQueriesMenu}
            style={{ fontSize: '12px', marginLeft: '-6px' }}
          >
            <Icons.chevron_down />
          </span>

          {isSavedQueriesMenuOpen && (
            <ul
              className="dropdown-menu visible"
              style={{
                right: 0,
                left: 'auto',
                minWidth: '220px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}
            >
              {savedQueriesList.length === 0 ? (
                <li style={{ color: '#999', cursor: 'default' }}>No saved queries yet.</li>
              ) : (
                savedQueriesList.map((query, index) => (
                  <li
                    key={index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySavedQuery(query);
                    }}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    {/* Render the saved query beautifully as a text string */}
                    {query.map(f => `${f.field} ${f.operator} "${f.value}"`).join(' AND ')}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}