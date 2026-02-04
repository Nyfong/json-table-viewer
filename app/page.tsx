'use client';

import { useState, useMemo, Fragment } from 'react';
import type React from 'react';

export default function Home() {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const parsedData = useMemo(() => {
    if (!jsonInput.trim()) {
      setError(null);
      return null;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      setError(null);
      return parsed;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      return null;
    }
  }, [jsonInput]);

  const formatJSON = (obj: any, indent: number = 0): string => {
    if (obj === null) return 'null';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj !== 'object') return String(obj);
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map(item => 
        '  '.repeat(indent + 1) + formatJSON(item, indent + 1)
      ).join(',\n');
      return `[\n${items}\n${'  '.repeat(indent)}]`;
    }

    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    
    const items = entries.map(([key, value]) => 
      '  '.repeat(indent + 1) + `"${key}": ${formatJSON(value, indent + 1)}`
    ).join(',\n');
    
    return `{\n${items}\n${'  '.repeat(indent)}}`;
  };

  const handleClear = () => {
    setJsonInput('');
    setError(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is JSON
    if (!file.name.endsWith('.json') && !file.type.includes('json')) {
      setError('Please select a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Try to parse to validate it's valid JSON
        JSON.parse(content);
        setJsonInput(content);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON file');
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };


  // Check if data can be displayed as table
  const canDisplayAsTable = (data: any): boolean => {
    if (!data) return false;
    if (Array.isArray(data)) {
      return true; // Always show arrays as tables
    }
    if (typeof data === 'object' && data !== null) {
      return true; // Show objects as key-value tables
    }
    return false;
  };

  // Get table structure for different data types
  const getTableStructure = (data: any, excludeKeys: string[] = []): { headers: string[], rows: any[][] } => {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { headers: ['Index', 'Value'], rows: [] };
      }
      
      // Array of objects
      if (data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
        const allKeys = new Set<string>();
        data.forEach(item => {
          Object.keys(item).forEach(key => {
            if (!excludeKeys.includes(key)) {
              allKeys.add(key);
            }
          });
        });
        const headers = Array.from(allKeys).sort();
        const rows = data.map(item => 
          headers.map(header => item[header])
        );
        return { headers, rows };
      }
      
      // Array of primitives or mixed
      const headers = ['Index', 'Value'];
      const rows = data.map((item, index) => [index, item]);
      return { headers, rows };
    }
    
    // Single object - show as key-value table
    if (typeof data === 'object' && data !== null) {
      const headers = ['Key', 'Value'];
      const rows = Object.entries(data)
        .filter(([key]) => !excludeKeys.includes(key))
        .map(([key, value]) => [key, value]);
      return { headers, rows };
    }
    
    return { headers: ['Value'], rows: [[data]] };
  };

  // Check if value is a nested structure that should be displayed separately
  const isNestedStructure = (value: any): boolean => {
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(item => typeof item === 'object' && item !== null);
    }
    return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
  };

  // Render nested tables for objects with arrays/objects
  const renderNestedTable = (key: string, value: any, level: number = 0): React.ReactNode => {
    if (Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'object' && item !== null)) {
      // Special handling for Results - exclude Packages and Vulnerabilities from columns
      const excludeKeys = key === 'Results' ? ['Packages', 'Vulnerabilities'] : [];
      const { headers, rows } = getTableStructure(value, excludeKeys);
      
      return (
        <div className={`mt-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-lg shadow-zinc-200/20 dark:shadow-zinc-900/50 overflow-hidden ${level > 0 ? 'ml-4' : ''}`}>
          {/* Modern Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 border-b border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{key}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToCSV(value, key);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-zinc-200 dark:border-zinc-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center gap-1.5"
                  title="Export to CSV"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
                  {value.length} {value.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Modern Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-b from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 backdrop-blur-sm">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                  <th className="px-4 py-4 w-20 text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                    Copy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/80 dark:divide-zinc-800/50">
                {rows.map((row, rowIndex) => {
                  const originalRow = value[rowIndex];
                  const hasPackages = originalRow?.Packages && Array.isArray(originalRow.Packages) && originalRow.Packages.length > 0;
                  const hasVulnerabilities = originalRow?.Vulnerabilities && Array.isArray(originalRow.Vulnerabilities) && originalRow.Vulnerabilities.length > 0;
                  const copyId = `nested-${key}-${rowIndex}`;
                  const isCopied = copiedIndex === copyId;
                  
                  return (
                    <Fragment key={rowIndex}>
                      <tr className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-zinc-800/40 dark:hover:to-zinc-800/20 transition-all duration-200">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 align-top group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors"
                          >
                            {renderCellValue(cell, headers[cellIndex], rowIndex)}
                          </td>
                        ))}
                        <td className="px-4 py-4 w-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyRecord(originalRow, rowIndex, `nested-${key}`);
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Copy record"
                          >
                            {isCopied ? (
                              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                      {/* Render Packages and Vulnerabilities as collapsible tables below each row */}
                      {(hasPackages || hasVulnerabilities) && (
                        <tr>
                          <td colSpan={headers.length} className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="space-y-4">
                              <div className="px-2 py-2 border-b-2 border-zinc-300 dark:border-zinc-700">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Table</h4>
                              </div>
                              <div className="space-y-4">
                                {hasVulnerabilities && (
                                  <div>{renderCollapsibleTable('Vulnerabilities', originalRow.Vulnerabilities, 1, `results-${rowIndex}-Vulnerabilities`)}</div>
                                )}
                                {hasPackages && (
                                  <div>{renderCollapsibleTable('Packages', originalRow.Packages, 2, `results-${rowIndex}-Packages`)}</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return null;
  };

  // Toggle collapse state for tables
  const toggleTable = (tableId: string) => {
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  };

  // Copy vulnerability record to clipboard
  const copyRecord = async (record: any, recordIndex: number, tableId: string) => {
    try {
      const jsonString = JSON.stringify(record, null, 2);
      await navigator.clipboard.writeText(jsonString);
      const copyId = `${tableId}-${recordIndex}`;
      setCopiedIndex(copyId);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Export table to CSV
  const exportToCSV = (data: any[], tableName: string) => {
    if (!data || data.length === 0) return;

    // Flatten nested objects and arrays for CSV
    const flattenObject = (obj: any, prefix = ''): Record<string, string> => {
      const flattened: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value === null || value === undefined) {
          flattened[newKey] = '';
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            flattened[newKey] = '[]';
          } else if (value.every(item => typeof item === 'object' && item !== null)) {
            // Array of objects - convert to JSON string
            flattened[newKey] = JSON.stringify(value);
          } else {
            // Array of primitives - join with semicolon
            flattened[newKey] = value.map(v => String(v)).join('; ');
          }
        } else if (typeof value === 'object') {
          // Nested object - flatten recursively
          Object.assign(flattened, flattenObject(value, newKey));
        } else {
          flattened[newKey] = String(value);
        }
      }
      
      return flattened;
    };

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach(item => {
      const flattened = flattenObject(item);
      Object.keys(flattened).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys).sort();
    
    // Create CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(item => {
        const flattened = flattenObject(item);
        return headers.map(header => {
          const value = flattened[header] || '';
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const escaped = String(value).replace(/"/g, '""');
          if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
            return `"${escaped}"`;
          }
          return escaped;
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render collapsible table for Packages/Vulnerabilities
  const renderCollapsibleTable = (key: string, value: any[], index: number, tableId: string): React.ReactNode => {
    const isCollapsed = collapsedTables.has(tableId);
    const { headers, rows } = getTableStructure(value);
    
  return (
      <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-md shadow-zinc-200/10 dark:shadow-zinc-900/30 overflow-hidden">
        {/* Collapsible Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 border-b border-zinc-200/60 dark:border-zinc-700/60">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleTable(tableId)}
              className="flex items-center gap-4 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {index}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{key}</h3>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exportToCSV(value, key);
                }}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-zinc-200 dark:border-zinc-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center gap-1.5"
                title="Export to CSV"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <span className="px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
                {value.length} {value.length === 1 ? 'item' : 'items'}
              </span>
              <button
                onClick={() => toggleTable(tableId)}
                className="p-1 hover:bg-white/50 dark:hover:bg-zinc-700/50 rounded transition-colors"
                aria-label="Toggle table"
              >
                <svg
                  className={`w-5 h-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Collapsible Content */}
        {!isCollapsed && (
          <div className="overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <table className="w-full">
              <thead className="bg-gradient-to-b from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                  <th className="px-4 py-4 w-20 text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                    Copy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/80 dark:divide-zinc-800/50">
                {rows.map((row, rowIndex) => {
                  const originalRecord = value[rowIndex];
                  const copyId = `${tableId}-${rowIndex}`;
                  const isCopied = copiedIndex === copyId;
                  
                  return (
                    <tr
                      key={rowIndex}
                      className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-zinc-800/40 dark:hover:to-zinc-800/20 transition-all duration-200 relative"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 align-top group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors"
                        >
                          {renderCellWithNestedArrays(cell, headers[cellIndex], rowIndex)}
                        </td>
                      ))}
                      {/* Copy button for all tables */}
                      <td className="px-4 py-4 w-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyRecord(originalRecord, rowIndex, tableId);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group/copy"
                          title="Copy record"
                        >
                          {isCopied ? (
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render nested arrays within table cells (for Results with Packages/Vulnerabilities)
  // ALWAYS expands all nested structures - never hides data
  const renderCellWithNestedArrays = (value: any, parentKey?: string, parentRowIndex?: number): React.ReactNode => {
    // Handle arrays of objects - render as nested table or collapsible if Packages/Vulnerabilities
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every(item => typeof item === 'object' && item !== null)) {
        // Check if this is Packages or Vulnerabilities - render as collapsible
        if (parentKey === 'Packages' || parentKey === 'Vulnerabilities') {
          const tableId = `table-${parentRowIndex}-${parentKey}`;
          const index = parentKey === 'Packages' ? 2 : 1; // Vulnerabilities = 1, Packages = 2
          return renderCollapsibleTable(parentKey, value, index, tableId);
        }
        // Always render arrays of objects as tables - never hide
        return renderNestedTable(parentKey || 'Array', value, 1);
      }
      // Array of primitives - show ALL values as badges (never hide)
      if (value.length > 0) {
        return (
          <div className="flex flex-wrap gap-1.5">
            {value.map((item, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800"
              >
                {renderCellValue(item, parentKey, parentRowIndex)}
              </span>
            ))}
          </div>
        );
      }
      return <span className="text-zinc-400 dark:text-zinc-500 text-xs">[]</span>;
    }
    
    // Handle objects - expand all properties
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const entries = Object.entries(value);
      
      // Check if object has nested arrays that need special rendering
      const hasNestedArrays = entries.some(([_, v]) => 
        Array.isArray(v) && v.length > 0 && v.every(item => typeof item === 'object' && item !== null)
      );
      
      if (hasNestedArrays) {
        // Object with nested arrays - show all properties, arrays as tables
        // Check if this object contains Packages or Vulnerabilities
        const packagesIndex = entries.findIndex(([k]) => k === 'Packages');
        const vulnerabilitiesIndex = entries.findIndex(([k]) => k === 'Vulnerabilities');
        
        if (packagesIndex !== -1 || vulnerabilitiesIndex !== -1) {
          // Render Packages and Vulnerabilities as collapsible tables with "Table" header
          const tableEntries = entries.filter(([k, v]) => 
            (k === 'Packages' || k === 'Vulnerabilities') && 
            Array.isArray(v) && v.length > 0 && v.every(item => typeof item === 'object' && item !== null)
          );
          const otherEntries = entries.filter(([k]) => k !== 'Packages' && k !== 'Vulnerabilities');
          
          return (
            <div className="space-y-4 py-2">
              {/* Other properties first */}
              {otherEntries.map(([k, v]) => {
                if (Array.isArray(v) && v.length > 0 && v.every(item => typeof item === 'object' && item !== null)) {
                  return <div key={k}>{renderNestedTable(k, v, 1)}</div>;
                }
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                  return (
                    <div key={k} className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{k}:</div>
                      <div className="ml-2">{renderCellWithNestedArrays(v, k, parentRowIndex)}</div>
                    </div>
                  );
                }
                return (
                  <div key={k} className="flex gap-2 text-xs py-0.5">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{k}:</span>
                    <span className="text-zinc-900 dark:text-zinc-100">{renderCellValue(v, k, parentRowIndex)}</span>
                  </div>
                );
              })}
              
              {/* Table section with collapsible tables */}
              {tableEntries.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="px-2 py-2 border-b-2 border-zinc-300 dark:border-zinc-700">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Table</h4>
                  </div>
                  {tableEntries
                    .sort(([a], [b]) => {
                      // Vulnerabilities first (1), then Packages (2)
                      const order = { 'Vulnerabilities': 1, 'Packages': 2 };
                      return (order[a as keyof typeof order] || 99) - (order[b as keyof typeof order] || 99);
                    })
                    .map(([k, v], idx) => {
                      const tableId = `table-${parentRowIndex || 0}-${k}`;
                      const index = k === 'Vulnerabilities' ? 1 : 2;
                      return <div key={k}>{renderCollapsibleTable(k, v as any[], index, tableId)}</div>;
                    })}
                </div>
              )}
            </div>
          );
        }
        
        // Regular nested arrays - expand everything
        return (
          <div className="space-y-3 py-2">
            {entries.map(([k, v]) => {
              if (Array.isArray(v)) {
                if (v.length > 0 && v.every(item => typeof item === 'object' && item !== null)) {
                  // Array of objects - render as table
                  return <div key={k}>{renderNestedTable(k, v, 1)}</div>;
                } else if (v.length > 0) {
                  // Array of primitives - show as list
                  return (
                    <div key={k} className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{k}:</div>
                      <div className="ml-2 space-y-0.5">
                        {v.map((item, idx) => (
                          <div key={idx} className="text-xs text-zinc-900 dark:text-zinc-100">• {renderCellValue(item, k, parentRowIndex)}</div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={k} className="flex gap-2 text-xs py-0.5">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{k}:</span>
                    <span className="text-zinc-900 dark:text-zinc-100">[]</span>
                  </div>
                );
              }
              // Recursively handle nested objects - always expand them
              if (typeof v === 'object' && v !== null) {
                return (
                  <div key={k} className="space-y-1 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{k}:</div>
                    <div className="ml-2">{renderCellWithNestedArrays(v, k, parentRowIndex)}</div>
                  </div>
                );
              }
              return (
                <div key={k} className="flex gap-2 text-xs py-0.5">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">{k}:</span>
                  <span className="text-zinc-900 dark:text-zinc-100">{renderCellValue(v)}</span>
                </div>
              );
            })}
          </div>
        );
      } else {
        // Simple object - show as key-value pairs, but still check for nested structures
        return (
          <div className="space-y-1 py-1">
            {entries.map(([k, v]) => {
              // Check if value is nested structure
              if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length > 0) {
                return (
                  <div key={k} className="space-y-1 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{k}:</div>
                    <div className="ml-2">{renderCellWithNestedArrays(v, k, parentRowIndex)}</div>
                  </div>
                );
              }
              if (Array.isArray(v)) {
                if (v.length > 0 && v.every(item => typeof item === 'object' && item !== null)) {
                  return <div key={k}>{renderNestedTable(k, v, 1)}</div>;
                } else if (v.length > 0) {
                  return (
                    <div key={k} className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{k}:</div>
                      <div className="ml-2 space-y-0.5">
                        {v.map((item, idx) => (
                          <div key={idx} className="text-xs text-zinc-900 dark:text-zinc-100">• {renderCellValue(item, k, parentRowIndex)}</div>
                        ))}
                      </div>
                    </div>
                  );
                }
              }
              return (
                <div key={k} className="flex gap-2 text-xs py-0.5">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">{k}:</span>
                  <span className="text-zinc-900 dark:text-zinc-100">{renderCellValue(v)}</span>
                </div>
              );
            })}
          </div>
        );
      }
    }
    
    return renderCellValue(value, parentKey, parentRowIndex);
  };

  // Render cell value with clean formatting - NEVER hide nested data
  const renderCellValue = (value: any, parentKey?: string, parentRowIndex?: number): React.ReactNode => {
    if (value === null) return <span className="text-zinc-400 dark:text-zinc-500">null</span>;
    if (value === undefined) return <span className="text-zinc-400 dark:text-zinc-500">undefined</span>;
    if (typeof value === 'boolean') {
      return (
        <span className={`${value ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
          {value ? '✓' : '✗'}
        </span>
      );
    }
    if (typeof value === 'number') {
      return <span className="text-zinc-900 dark:text-zinc-100 font-mono">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-zinc-900 dark:text-zinc-100">{value}</span>;
    }
    // If it's an object or array, expand it instead of hiding
    if (typeof value === 'object') {
      return renderCellWithNestedArrays(value, parentKey, parentRowIndex);
    }
    return <span className="text-zinc-900 dark:text-zinc-100">{String(value)}</span>;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="shrink-0">
              <img
                src="/logo.png"
                alt="Logo"
                width={48}
                height={48}
                className="rounded-lg object-contain w-12 h-12"
              />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100">
                DSP JSON Table Viewer
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Paste JSON data to view as a table
              </p>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="flex flex-col mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Input
            </h2>
            <div className="flex gap-2">
              <label className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                Upload JSON
              </label>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='Paste JSON here...'
            className="w-full h-[400px] p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
          />
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
              <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error</p>
              <p className="text-xs text-red-600 dark:text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Table
            </h2>
            {parsedData && (
              <span className="px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded">
                Valid
              </span>
            )}
          </div>
          <div className="overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
            {!jsonInput.trim() ? (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  Enter JSON to view table
                </p>
              </div>
            ) : error ? (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-sm text-red-500 dark:text-red-400">
                  Invalid JSON
                </p>
              </div>
            ) : parsedData && canDisplayAsTable(parsedData) ? (
              (() => {
                // If it's an object with nested arrays/objects, show each key as a section
                if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData !== null) {
                  const entries = Object.entries(parsedData);
                  const hasNestedStructures = entries.some(([_, value]) => isNestedStructure(value));
                  
                  if (hasNestedStructures) {
                    return (
                      <div className="space-y-6 p-6">
                        {entries.map(([key, value]) => {
                          if (isNestedStructure(value)) {
                            // Render nested table for arrays of objects
                            const nestedTable = renderNestedTable(key, value);
                            if (nestedTable) {
                              return <div key={key}>{nestedTable}</div>;
                            }
                            
                            // Render nested object as key-value table
                            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                              const { headers, rows } = getTableStructure(value);
                              return (
                                <div key={key} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-lg shadow-zinc-200/20 dark:shadow-zinc-900/50 overflow-hidden">
                                  <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 border-b border-zinc-200/60 dark:border-zinc-700/60">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{key}</h3>
                                      </div>
                                      {typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            exportToCSV([value], key);
                                          }}
                                          className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-zinc-200 dark:border-zinc-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center gap-1.5"
                                          title="Export to CSV"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          Export CSV
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead className="bg-gradient-to-b from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700">
                                        <tr>
                                          {headers.map((header) => (
                                            <th
                                              key={header}
                                              className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider"
                                            >
                                              {header}
                                            </th>
                                          ))}
                                          <th className="px-4 py-4 w-20 text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                                            Copy
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100/80 dark:divide-zinc-800/50">
                                        {rows.map((row, rowIndex) => {
                                          const originalRow = Array.isArray(value) ? value[rowIndex] : Object.fromEntries(
                                            headers.map((h, idx) => [h, row[idx]])
                                          );
                                          const copyId = `nested-obj-${key}-${rowIndex}`;
                                          const isCopied = copiedIndex === copyId;
                                          
                                          return (
                                            <tr
                                              key={rowIndex}
                                              className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-zinc-800/40 dark:hover:to-zinc-800/20 transition-all duration-200"
                                            >
                                              {row.map((cell, cellIndex) => (
                                                <td
                                                  key={cellIndex}
                                                  className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 align-top group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors"
                                                >
                                                  {renderCellWithNestedArrays(cell, headers[cellIndex], rowIndex)}
                                                </td>
                                              ))}
                                              <td className="px-4 py-4 w-20">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyRecord(originalRow, rowIndex, `nested-obj-${key}`);
                                                  }}
                                                  className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                  title="Copy record"
                                                >
                                                  {isCopied ? (
                                                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                  ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                  )}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            }
                          }
                          
                          // Render simple key-value pairs
                          return (
                            <div key={key} className="flex items-start gap-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
                              <div className="w-40 flex-shrink-0">
                                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{key}</span>
                              </div>
                              <div className="flex-1">
                                {renderCellWithNestedArrays(value, key)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                }
                
                // Standard table display for arrays or simple objects
                const { headers, rows } = getTableStructure(parsedData);
                const isArrayData = Array.isArray(parsedData);
                
                return (
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-lg shadow-zinc-200/20 dark:shadow-zinc-900/50 overflow-hidden">
                    {/* Export button for standard table */}
                    {isArrayData && parsedData.length > 0 && (
                      <div className="px-6 py-3 bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700 flex justify-end">
                        <button
                          onClick={() => exportToCSV(parsedData, 'Table')}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-zinc-200 dark:border-zinc-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center gap-1.5"
                          title="Export to CSV"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export CSV
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gradient-to-b from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b-2 border-zinc-200 dark:border-zinc-700 z-10 backdrop-blur-sm">
                          <tr>
                            {headers.map((header) => (
                              <th
                                key={header}
                                className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                            {isArrayData && (
                              <th className="px-4 py-4 w-20 text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                                Copy
                              </th>
                            )}
                          </tr>
                        </thead>
                      <tbody className="divide-y divide-zinc-100/80 dark:divide-zinc-800/50">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={headers.length + (isArrayData ? 1 : 0)}
                              className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500"
                            >
                              No data
                            </td>
                          </tr>
                        ) : (
                          rows.map((row, rowIndex) => {
                            const originalRow = isArrayData ? parsedData[rowIndex] : Object.fromEntries(
                              headers.map((h, idx) => [h, row[idx]])
                            );
                            const copyId = `standard-${rowIndex}`;
                            const isCopied = copiedIndex === copyId;
                            
                            return (
                              <tr
                                key={rowIndex}
                                className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-zinc-800/40 dark:hover:to-zinc-800/20 transition-all duration-200"
                              >
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 align-top group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors"
                                  >
                                    {renderCellWithNestedArrays(cell, headers[cellIndex], rowIndex)}
                                  </td>
                                ))}
                                {isArrayData && (
                                  <td className="px-4 py-4 w-20">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyRecord(originalRow, rowIndex, 'standard');
                                      }}
                                      className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      title="Copy record"
                                    >
                                      {isCopied ? (
                                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      )}
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  Cannot display as table
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        {parsedData && (
          <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Type</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {Array.isArray(parsedData) ? 'Array' : typeof parsedData}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Items</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {Array.isArray(parsedData) 
                    ? parsedData.length 
                    : Object.keys(parsedData).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Size</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {new Blob([jsonInput]).size} bytes
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Depth</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {getDepth(parsedData)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDepth(obj: any, currentDepth: number = 0): number {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return currentDepth;
    return Math.max(...obj.map(item => getDepth(item, currentDepth + 1)));
  }
  
  const entries = Object.values(obj);
  if (entries.length === 0) return currentDepth;
  return Math.max(...entries.map(value => getDepth(value, currentDepth + 1)));
}
