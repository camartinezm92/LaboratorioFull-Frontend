import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatColombia, getColombiaDateString } from '../utils/dateUtils';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface ExcelExportButtonProps {
  collections: { 
    name: string; 
    label: string; 
    sortField?: string;
    columnMapping?: Record<string, string>;
  }[];
  filename: string;
  buttonText?: string;
  className?: string;
}

export const ExcelExportButton: React.FC<ExcelExportButtonProps> = ({
  collections,
  filename,
  buttonText = 'Exportar a Excel',
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      for (const col of collections) {
        try {
          let q;
          if (col.sortField) {
            q = query(collection(db, col.name), orderBy(col.sortField, 'desc'));
          } else {
            q = collection(db, col.name);
          }
          
          const querySnapshot = await getDocs(q as any);
          const data = querySnapshot.docs.map(doc => {
            const docData = doc.data() as any;
            const flattened: any = {};
            
            // If columnMapping is provided, we use it to order and name columns
            if (col.columnMapping) {
              Object.entries(col.columnMapping).forEach(([key, label]) => {
                if (key.includes('_')) {
                  const [parent, child] = key.split('_');
                  if (docData[parent] && typeof docData[parent] === 'object') {
                    flattened[label] = docData[parent][child];
                  }
                } else {
                  let value;
                  if (key.startsWith('parameter:')) {
                    const paramName = key.split(':')[1];
                    const param = docData.parameters?.find((p: any) => 
                      p.name.toLowerCase() === paramName.toLowerCase() || 
                      p.name.toLowerCase().includes(paramName.toLowerCase())
                    );
                    value = param ? `${param.value} ${param.unit}` : '';
                  } else {
                    value = docData[key];
                    // Handle Firestore Timestamps and ISO strings
                    if (value) {
                      value = formatColombia(value);
                    }
                  }

                  if (Array.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === 'object') {
                      // Special handling for laboratory parameters or similar objects
                      value = value.map((item: any) => {
                        if (item.name && item.value !== undefined) {
                          let str = `${item.name}: ${item.value}`;
                          if (item.unit) str += ` ${item.unit}`;
                          if (item.referenceRange) str += ` (Ref: ${item.referenceRange})`;
                          if (item.status && item.status !== 'Normal') str += ` [${item.status}]`;
                          if (item.analysis) str += ` - ${item.analysis}`;
                          return str;
                        }
                        if (item.concentration !== undefined && item.absorbance !== undefined) {
                          return `(C:${item.concentration}, A:${item.absorbance})`;
                        }
                        if (item.x !== undefined && item.y !== undefined) {
                          return `(${item.x}, ${item.y})`;
                        }
                        return JSON.stringify(item);
                      }).join(' | ');
                    } else {
                      value = value.join(', ');
                    }
                  }
                  flattened[label] = value;
                }
              });
            } else {
              // Fallback to original behavior if no mapping
              Object.keys(docData).forEach(key => {
                let value = docData[key];
                
                // Handle Firestore Timestamps and date strings
                if (value) {
                  flattened[key] = formatColombia(value);
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  Object.keys(value).forEach(subKey => {
                    flattened[`${key}_${subKey}`] = value[subKey];
                  });
                } else if (Array.isArray(value)) {
                  flattened[key] = JSON.stringify(value);
                } else {
                  flattened[key] = value;
                }
              });
            }
            return flattened;
          });

          const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ info: 'Sin datos registrados' }]);
          XLSX.utils.book_append_sheet(wb, ws, col.label.substring(0, 31));
        } catch (error) {
          console.error(`Error fetching collection ${col.name}:`, error);
        }
      }

      XLSX.writeFile(wb, `${filename}_${getColombiaDateString()}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      id="excel-export-button"
      onClick={handleExport}
      disabled={isExporting}
      className={`flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50 ${className}`}
    >
      {isExporting ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
      {buttonText}
    </button>
  );
};
