import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  History, 
  Search, 
  Package, 
  AlertTriangle,
  Save,
  X,
  Trash2,
  Edit,
  Filter,
  ClipboardList,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc, 
  doc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { ExcelExportButton } from '../../components/ExcelExportButton';
import { getNowISO, getColombiaDateString, formatColombia } from '../../utils/dateUtils';

// Types
interface Supply {
  id: string;
  name: string;
  description: string;
  category: string;
  currentStock: number;
  unit: string;
  minStock: number;
}

interface KardexEntry {
  id: string;
  supplyId: string;
  supplyName?: string;
  supplyCategory?: string;
  date: any;
  createdAt?: any;
  type: 'input' | 'output' | 'action';
  quantity: number;
  balance: number;
  responsible: string;
  observations: string;
  batch: string;
  expirationDate: string;
  actionType?: string;
  invimaRecord?: string;
}

interface BatchInfo {
  batch: string;
  expirationDate: string;
  currentBalance: number;
  status: 'red' | 'yellow' | 'green' | 'black';
  invimaRecord?: string;
}

export const Kardex: React.FC = () => {
  const navigate = useNavigate();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [allEntries, setAllEntries] = useState<KardexEntry[]>([]);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [history, setHistory] = useState<KardexEntry[]>([]);
  const [isAddingSupply, setIsAddingSupply] = useState(false);
  const [isRecordingMovement, setIsRecordingMovement] = useState(false);
  const [movementType, setMovementType] = useState<'input' | 'output'>('input');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'input' | 'output' | 'action'>('all');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [isEditingSupply, setIsEditingSupply] = useState(false);
  const [editSupplyData, setEditSupplyData] = useState<Supply | null>(null);

  // New states for batch actions and notifications
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<BatchInfo | null>(null);
  const [batchJustification, setBatchJustification] = useState('');
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Initialize all categories as expanded
  useEffect(() => {
    if (supplies.length > 0) {
      const uniqueCategories = Array.from(new Set(supplies.map(s => s.category)));
      const initialExpanded: Record<string, boolean> = {};
      uniqueCategories.forEach(cat => {
        initialExpanded[cat] = true;
      });
      setExpandedCategories(initialExpanded);
    }
  }, [supplies.length === 0]); // Only run once when supplies are first loaded

  const [isDeletingSupply, setIsDeletingSupply] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isClosingInventory, setIsClosingInventory] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Form states
  const [newSupply, setNewSupply] = useState({
    name: '',
    description: '',
    category: 'Insumo',
    unit: 'Unidad',
    minStock: 0
  });

  const [movement, setMovement] = useState({
    quantity: 0,
    responsible: auth.currentUser?.uid || auth.currentUser?.email || '',
    observations: '',
    batch: '',
    expirationDate: '',
    invimaRecord: ''
  });

  useEffect(() => {
    if (auth.currentUser) {
      setMovement(prev => ({ ...prev, responsible: auth.currentUser?.uid || auth.currentUser?.email || '' }));
    }
  }, [auth.currentUser]);

  useEffect(() => {
    const q = query(collection(db, 'supplies'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supply));
      setSupplies(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'supplies'));

    return () => unsubscribe();
  }, []);

  // Fetch all entries to calculate summaries
  useEffect(() => {
    const q = query(collection(db, 'kardexEntries'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KardexEntry));
      setAllEntries(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'kardexEntries'));

    return () => unsubscribe();
  }, []);

  // Automatic removal of expired batches
  useEffect(() => {
    if (supplies.length === 0 || allEntries.length === 0) return;

    const checkExpirations = async () => {
      if (!auth.currentUser) return;
      
      const today = new Date(getColombiaDateString() + 'T00:00:00');

      for (const supply of supplies) {
        // Fix negative stock
        if (supply.currentStock < 0) {
          try {
            console.log(`Corrigiendo stock negativo para ${supply.name}: ${supply.currentStock} -> 0`);
            await fetch('/api/records/kardexEntries', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: Math.random().toString(36).substring(2, 15),
                supplyId: supply.id,
                supplyName: supply.name,
                supplyCategory: supply.category,
                date: getNowISO(),
                type: 'action',
                actionType: 'stock_correction',
                quantity: Math.abs(supply.currentStock),
                balance: 0,
                responsible: 'Sistema (Auto)',
                observations: `Corrección automática de stock negativo (${supply.currentStock})`,
                batch: 'N/A',
                expirationDate: 'N/A',
                invimaRecord: 'N/A',
                userEmail: auth.currentUser.email,
                uid: auth.currentUser.uid,
                createdAt: getNowISO()
              })
            });
            await updateDoc(doc(db, 'supplies', supply.id), {
              currentStock: 0
            });
          } catch (e) {
            console.error('Error correcting negative stock:', e);
          }
        }

        const batches = getSupplyBatches(supply.id);
        for (const batch of batches) {
          if (batch.status === 'black' && batch.currentBalance > 0) {
            try {
              // Ensure stock doesn't go below zero
              const newBalance = Math.max(0, supply.currentStock - batch.currentBalance);
              
              console.log(`Intentando retirar lote ${batch.batch} de ${supply.name}. Stock actual: ${supply.currentStock}, Lote: ${batch.currentBalance}. Nuevo balance: ${newBalance}`);

              // Record automatic removal
              try {
                await fetch('/api/records/kardexEntries', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: Math.random().toString(36).substring(2, 15),
                    supplyId: supply.id,
                    supplyName: supply.name,
                    supplyCategory: supply.category,
                    date: getNowISO(),
                    type: 'action',
                    actionType: 'delete_batch',
                    quantity: batch.currentBalance,
                    balance: newBalance,
                    responsible: 'Sistema (Auto)',
                    observations: `retiro de lote por fecha de vencimiento`,
                    batch: batch.batch,
                    expirationDate: batch.expirationDate,
                    invimaRecord: 'N/A',
                    userEmail: auth.currentUser.email,
                    uid: auth.currentUser.uid,
                    createdAt: getNowISO()
                  })
                });
                console.log('Kardex entry recorded successfully');
              } catch (e) {
                console.error('Failed to record Kardex entry:', e);
                throw e;
              }

              // Update supply stock
              try {
                await updateDoc(doc(db, 'supplies', supply.id), {
                  currentStock: newBalance
                });
                console.log('Supply stock updated successfully');
              } catch (e) {
                console.error('Failed to update supply stock:', e);
                throw e;
              }
              
              console.log(`Lote ${batch.batch} de ${supply.name} retirado por vencimiento.`);
            } catch (error) {
              console.error('Error in automatic batch removal process:', error);
            }
          }
        }
      }
    };

    // Run check
    checkExpirations();
  }, [allEntries, supplies]);

  useEffect(() => {
    if (selectedSupply) {
      const data = allEntries
        .filter(entry => entry.supplyId === selectedSupply.id)
        .sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });
      setHistory(data);
    }
  }, [selectedSupply, allEntries]);

  const getBatchStatus = (expirationDate: string): 'red' | 'yellow' | 'green' | 'black' => {
    if (!expirationDate) return 'green';
    const exp = new Date(expirationDate + 'T00:00:00');
    const today = new Date(getColombiaDateString() + 'T00:00:00');
    
    if (exp < today) return 'black';

    const diffTime = exp.getTime() - today.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

    if (diffMonths <= 3) return 'red';
    if (diffMonths <= 6) return 'yellow';
    return 'green';
  };

  const getSupplyBatches = (supplyId: string): BatchInfo[] => {
    const supplyEntries = allEntries.filter(e => e.supplyId === supplyId);
    const batchMap: Record<string, { balance: number, exp: string, invima: string }> = {};

    supplyEntries.forEach(entry => {
      if (!entry.batch) return;
      if (!batchMap[entry.batch]) {
        batchMap[entry.batch] = { balance: 0, exp: entry.expirationDate || '', invima: entry.invimaRecord || '' };
      }
      if (entry.type === 'input') {
        batchMap[entry.batch].balance += entry.quantity;
        // Update expiration if it was missing or different (inputs define the exp)
        if (entry.expirationDate) batchMap[entry.batch].exp = entry.expirationDate;
        if (entry.invimaRecord) batchMap[entry.batch].invima = entry.invimaRecord;
      } else {
        batchMap[entry.batch].balance -= entry.quantity;
      }
    });

    return Object.entries(batchMap)
      .map(([batch, info]) => ({
        batch,
        expirationDate: info.exp,
        currentBalance: info.balance,
        status: getBatchStatus(info.exp),
        invimaRecord: info.invima
      }))
      .filter(b => b.currentBalance > 0);
  };

  const getSupplySummary = (supplyId: string) => {
    const batches = getSupplyBatches(supplyId);
    return {
      red: batches.filter(b => b.status === 'red').length,
      yellow: batches.filter(b => b.status === 'yellow').length,
      green: batches.filter(b => b.status === 'green').length,
      black: batches.filter(b => b.status === 'black').length,
    };
  };

  const handleAddSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'supplies'), {
        ...newSupply,
        currentStock: 0,
        userEmail: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        createdAt: getNowISO()
      });
      setIsAddingSupply(false);
      setNewSupply({ name: '', description: '', category: 'Insumo', unit: 'Unidad', minStock: 0 });
      showNotification('success', 'Insumo creado correctamente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'supplies');
      showNotification('error', 'Error al crear el insumo.');
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply) return;

    if (!movement.batch) {
      showNotification('warning', 'El número de lote es obligatorio.');
      return;
    }

    const quantity = Number(movement.quantity);
    const newBalance = movementType === 'input' 
      ? selectedSupply.currentStock + quantity 
      : selectedSupply.currentStock - quantity;

    if (newBalance < 0) {
      showNotification('error', 'El stock no puede ser negativo.');
      return;
    }

    // If output, check batch balance
    if (movementType === 'output') {
      const batches = getSupplyBatches(selectedSupply.id);
      const targetBatch = batches.find(b => b.batch === movement.batch);
      if (!targetBatch || targetBatch.currentBalance < quantity) {
        showNotification('error', `El lote ${movement.batch} no tiene suficiente stock.`);
        return;
      }
    }

    try {
      // 1. Create Kardex Entry via API for Google Sheets sync
      const entryId = Math.random().toString(36).substring(2, 15);
      const entryData = {
        id: entryId,
        supplyId: selectedSupply.id,
        supplyName: selectedSupply.name,
        supplyCategory: selectedSupply.category,
        date: getNowISO(),
        type: movementType,
        actionType: movementType, // 'input' or 'output'
        quantity,
        balance: newBalance,
        responsible: movement.responsible,
        observations: movement.observations,
        batch: movement.batch,
        expirationDate: movement.expirationDate,
        invimaRecord: movement.invimaRecord || 'N/A',
        userEmail: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        createdAt: getNowISO()
      };

      await fetch('/api/records/kardexEntries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      // 2. Update Supply Stock
      await updateDoc(doc(db, 'supplies', selectedSupply.id), {
        currentStock: newBalance
      });

      setIsRecordingMovement(false);
      setMovement({ 
        quantity: 0, 
        responsible: auth.currentUser?.email || '', 
        observations: '', 
        batch: '', 
        expirationDate: '',
        invimaRecord: ''
      });
      
      setSelectedSupply({ ...selectedSupply, currentStock: newBalance });
      showNotification('success', `Movimiento de ${movementType === 'input' ? 'entrada' : 'salida'} registrado.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'kardexEntries');
      showNotification('error', 'Error al registrar el movimiento.');
    }
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply || !batchToEdit || !batchJustification) return;

    try {
      // Record action in history via API for Google Sheets sync
      const entryId = Math.random().toString(36).substring(2, 15);
      const entryData = {
        id: entryId,
        supplyId: selectedSupply.id,
        supplyName: selectedSupply.name,
        supplyCategory: selectedSupply.category,
        date: getNowISO(),
        type: 'action',
        actionType: 'edit_batch',
        quantity: 0,
        balance: selectedSupply.currentStock,
        responsible: auth.currentUser?.email || 'Sistema',
        observations: `Modificación de fecha de vencimiento del lote ${batchToEdit.batch}. Justificación: ${batchJustification}. Nueva fecha: ${newExpirationDate}`,
        batch: batchToEdit.batch,
        expirationDate: newExpirationDate,
        invimaRecord: 'N/A',
        userEmail: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        createdAt: getNowISO()
      };

      await fetch('/api/records/kardexEntries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      // Update all entries of this batch to reflect new expiration date (for consistency in summary calculation)
      // Note: In a real app, we might want a separate 'batches' collection, but here we calculate from entries.
      // So we'll just add an entry that "corrects" it or we'd have to update all previous entries.
      // For this implementation, the summary uses the latest info from entries.
      
      setIsEditingBatch(false);
      setBatchJustification('');
      setBatchToEdit(null);
      showNotification('success', 'Lote actualizado correctamente.');
    } catch (error) {
      showNotification('error', 'Error al actualizar el lote.');
    }
  };

  const handleDeleteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply || !batchToEdit || !batchJustification) return;

    try {
      const newBalance = Math.max(0, selectedSupply.currentStock - batchToEdit.currentBalance);

      // 1. Record action in history via API for Google Sheets sync
      const entryId = Math.random().toString(36).substring(2, 15);
      const entryData = {
        id: entryId,
        supplyId: selectedSupply.id,
        supplyName: selectedSupply.name,
        supplyCategory: selectedSupply.category,
        date: getNowISO(),
        type: 'action',
        actionType: 'delete_batch',
        quantity: batchToEdit.currentBalance,
        balance: newBalance,
        responsible: auth.currentUser?.email || 'Sistema',
        observations: `Eliminación del lote ${batchToEdit.batch}. Justificación: ${batchJustification}`,
        batch: batchToEdit.batch,
        expirationDate: batchToEdit.expirationDate,
        invimaRecord: 'N/A',
        userEmail: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        createdAt: getNowISO()
      };

      await fetch('/api/records/kardexEntries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      // 2. Update Supply Stock
      await updateDoc(doc(db, 'supplies', selectedSupply.id), {
        currentStock: newBalance
      });

      setIsDeletingBatch(false);
      setBatchJustification('');
      setBatchToEdit(null);
      setSelectedSupply({ ...selectedSupply, currentStock: newBalance });
      showNotification('success', 'Lote eliminado y stock ajustado.');
    } catch (error) {
      showNotification('error', 'Error al eliminar el lote.');
    }
  };

  const handleEditSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplyData || !selectedSupply) return;
    try {
      await updateDoc(doc(db, 'supplies', editSupplyData.id), {
        name: editSupplyData.name,
        description: editSupplyData.description,
        category: editSupplyData.category,
        unit: editSupplyData.unit,
        minStock: editSupplyData.minStock
      });

      // Record action via API for Google Sheets sync
      const entryId = Math.random().toString(36).substring(2, 15);
      const entryData = {
        id: entryId,
        supplyId: selectedSupply.id,
        supplyName: editSupplyData.name,
        supplyCategory: editSupplyData.category,
        date: getNowISO(),
        type: 'action',
        actionType: 'edit_supply',
        quantity: 0,
        balance: selectedSupply.currentStock,
        responsible: auth.currentUser?.email || 'Sistema',
        observations: `Modificación de datos maestros del insumo.`,
        batch: 'N/A',
        expirationDate: 'N/A',
        invimaRecord: 'N/A',
        userEmail: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        createdAt: getNowISO()
      };

      await fetch('/api/records/kardexEntries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      setIsEditingSupply(false);
      setSelectedSupply(prev => prev ? { ...prev, ...editSupplyData } : null);
      showNotification('success', 'Insumo actualizado.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'supplies');
      showNotification('error', 'Error al actualizar el insumo.');
    }
  };

  const isAdmin = () => {
    return auth.currentUser?.uid === 'admin' || auth.currentUser?.email?.toLowerCase() === 'ingbiomedico@ucihonda.com.co';
  };

  const handleDeleteSupply = async () => {
    if (!selectedSupply || isDeletingSupply) {
      console.log('Delete aborted: no supply selected or already deleting');
      return;
    }
    
    setIsDeletingSupply(true);
    try {
      console.log(`[DELETE] Iniciando proceso para: ${selectedSupply.id} (${selectedSupply.name})`);
      
      // 1. Delete the supply document FIRST
      await deleteDoc(doc(db, 'supplies', selectedSupply.id));
      console.log('[DELETE] Documento eliminado exitosamente');
      
      // 2. Record action in audit log via API for Google Sheets sync
      try {
        const entryId = Math.random().toString(36).substring(2, 15);
        const entryData: any = {
          id: entryId,
          supplyId: selectedSupply.id,
          supplyName: selectedSupply.name,
          date: getNowISO(),
          type: 'action',
          actionType: 'delete_supply',
          quantity: 0,
          balance: 0,
          responsible: auth.currentUser?.email || 'Sistema',
          observations: `Insumo eliminado del catálogo activo por el usuario.`,
          batch: 'N/A',
          expirationDate: 'N/A',
          invimaRecord: 'N/A',
          userEmail: auth.currentUser?.email || '',
          uid: auth.currentUser?.uid || 'system',
          createdAt: getNowISO()
        };
        
        if (selectedSupply.category) {
          entryData.supplyCategory = selectedSupply.category;
        }

        await fetch('/api/records/kardexEntries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData)
        });
      } catch (auditError) {
        console.warn('[DELETE] Error al crear registro de auditoría:', auditError);
      }
      
      setSelectedSupply(null);
      setShowConfirmDelete(false);
      showNotification('success', `Insumo "${selectedSupply.name}" eliminado exitosamente.`);
      
    } catch (error: any) {
      console.error('[DELETE] Error crítico:', error);
      showNotification('error', 'Error al eliminar el insumo.');
    } finally {
      setIsDeletingSupply(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!isAdmin() || isResetting) return;
    
    setIsResetting(true);
    try {
      console.log('[RESET] Iniciando limpieza total de base de datos...');
      
      // Delete all supplies
      const suppliesSnap = await getDocs(collection(db, 'supplies'));
      const supplyDeletions = suppliesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(supplyDeletions);
      console.log(`[RESET] ${suppliesSnap.size} insumos eliminados`);

      // Delete all kardex entries
      const kardexSnap = await getDocs(collection(db, 'kardexEntries'));
      const kardexDeletions = kardexSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(kardexDeletions);
      console.log(`[RESET] ${kardexSnap.size} registros de kardex eliminados`);

      showNotification('success', 'Base de datos reiniciada exitosamente. Todos los datos han sido borrados.');
      setShowConfirmReset(false);
      setSelectedSupply(null);
    } catch (error) {
      console.error('[RESET] Error:', error);
      showNotification('error', 'Error al reiniciar la base de datos.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCloseInventory = async () => {
    try {
      setIsClosingInventory(true);
      const doc = new jsPDF();
      const date = formatColombia(new Date());
      const responsible = auth.currentUser?.email || 'Sistema';

      // PDF Header
      doc.setFontSize(18);
      doc.text('Reporte de Cierre de Inventario', 14, 22);
      doc.setFontSize(10);
      doc.text(`Fecha: ${date}`, 14, 30);
      doc.text(`Responsable: ${responsible}`, 14, 35);

      // Prepare data for PDF and Excel
      const inventoryItems: any[] = [];
      supplies.forEach(supply => {
        const batches = getSupplyBatches(supply.id);
        batches.forEach(batch => {
          inventoryItems.push({
            name: supply.name,
            category: supply.category,
            batch: batch.batch,
            expirationDate: batch.expirationDate || 'N/A',
            invimaRecord: batch.invimaRecord || 'N/A',
            stock: batch.currentBalance,
            unit: supply.unit
          });
        });
      });

      if (inventoryItems.length === 0) {
        showNotification('warning', 'No hay insumos con stock para cerrar el inventario.');
        setIsClosingInventory(false);
        setShowConfirmClose(false);
        return;
      }

      // PDF Table
      autoTable(doc, {
        startY: 45,
        head: [['Insumo', 'Categoría', 'Lote', 'Vence', 'INVIMA', 'Stock', 'Unidad']],
        body: inventoryItems.map(item => [
          item.name,
          item.category,
          item.batch,
          item.expirationDate,
          item.invimaRecord,
          item.stock,
          item.unit
        ]),
        theme: 'striped',
        headStyles: { fillColor: [39, 39, 42] }
      });

      // Save PDF locally
      doc.save(`Cierre_Inventario_${getColombiaDateString()}.pdf`);

      // Save to Excel via API
      const response = await fetch('/api/inventory/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: inventoryItems,
          responsible
        })
      });

      if (!response.ok) throw new Error('Error al sincronizar con Excel');

      showNotification('success', 'Inventario cerrado, PDF generado y sincronizado con Excel correctamente.');
      setShowConfirmClose(false);
    } catch (error) {
      console.error('Error closing inventory:', error);
      showNotification('error', 'Error al cerrar el inventario.');
    } finally {
      setIsClosingInventory(false);
    }
  };

  const onBatchSelect = (batchName: string) => {
    if (movementType === 'output') {
      const batches = getSupplyBatches(selectedSupply?.id || '');
      const selected = batches.find(b => b.batch === batchName);
      if (selected) {
        setMovement(prev => ({
          ...prev,
          batch: batchName,
          expirationDate: selected.expirationDate
        }));
      }
    } else {
      setMovement(prev => ({ ...prev, batch: batchName }));
    }
  };

  const filteredSupplies = supplies.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Todas' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredHistory = history.filter(entry => {
    if (historyFilter === 'all') return true;
    return entry.type === historyFilter;
  });

  const categories = ['Todas', ...Array.from(new Set(supplies.map(s => s.category)))];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : 
             notification.type === 'error' ? <X size={18} /> : 
             <AlertCircle size={18} />}
            <span className="text-sm font-bold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/insumos')}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Control de Inventario</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Control de inventarios y gestión de insumos de apoyo diagnóstico</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin() && (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-red-100 transition-colors text-sm font-bold shadow-sm"
              >
                <Trash2 size={18} />
                Reiniciar Base de Datos
              </button>
            )}
            <ExcelExportButton 
              filename="Kardex_Insumos"
              buttonText="Exportar Excel"
              className="px-4 py-2 rounded-xl text-sm shadow-sm"
              collections={[
                { 
                  name: 'supplies', 
                  label: 'Inventario Actual', 
                  sortField: 'createdAt',
                  columnMapping: {
                    name: 'Nombre del Insumo',
                    description: 'Descripción',
                    category: 'Categoría',
                    currentStock: 'Stock Actual',
                    unit: 'Unidad de Medida',
                    minStock: 'Stock Mínimo',
                    createdAt: 'Fecha de Registro'
                  }
                },
                { 
                  name: 'kardexEntries', 
                  label: 'Movimientos Kardex', 
                  sortField: 'createdAt',
                  columnMapping: {
                    date: 'Fecha del Movimiento',
                    type: 'Tipo (Entrada/Salida)',
                    quantity: 'Cantidad',
                    balance: 'Saldo Resultante',
                    responsible: 'Responsable',
                    observations: 'Observaciones',
                    batch: 'Lote',
                    expirationDate: 'Fecha de Vencimiento',
                    createdAt: 'Fecha de Registro'
                  }
                }
              ]}
            />
            <button
              onClick={() => navigate('/insumos/auditoria')}
              className="bg-white text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-50 transition-colors text-sm font-bold shadow-sm"
            >
              <ShieldCheck size={18} />
              Lista Maestra
            </button>
            <button
              onClick={() => setShowConfirmClose(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-colors text-sm font-bold shadow-sm"
            >
              <FileCheck size={18} />
              Cerrar Inventario
            </button>
            <button
              onClick={() => setIsAddingSupply(true)}
              className="bg-zinc-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-800 transition-colors text-sm font-bold shadow-sm"
            >
              <Plus size={18} />
              Nuevo Insumo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar: Supply List */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  categoryFilter === cat 
                    ? 'bg-zinc-900 text-white border-zinc-900' 
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden flex-1 shadow-sm">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Package size={16} />
                Lista de Insumos
              </h2>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {filteredSupplies.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 italic text-sm">
                  No se encontraron insumos.
                </div>
              ) : (
                (() => {
                  const grouped = filteredSupplies.reduce((acc, supply) => {
                    const cat = supply.category || 'Sin Categoría';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(supply);
                    return acc;
                  }, {} as Record<string, Supply[]>);

                  return Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="border-b border-zinc-100 last:border-0">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-4 py-2 bg-zinc-50/80 flex items-center justify-between hover:bg-zinc-100 transition-colors group"
                      >
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <Filter size={10} className="text-zinc-400" />
                          {category}
                          <span className="bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded-full text-[9px]">
                            {items.length}
                          </span>
                        </span>
                        <motion.div
                          animate={{ rotate: expandedCategories[category] ? 0 : -90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={14} className="text-zinc-400" />
                        </motion.div>
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {expandedCategories[category] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {items.map(supply => {
                              const summary = getSupplySummary(supply.id);
                              return (
                                <button
                                  key={supply.id}
                                  onClick={() => setSelectedSupply(supply)}
                                  className={`w-full p-4 text-left border-b border-zinc-50 last:border-0 transition-all hover:bg-zinc-50 flex items-center justify-between group ${selectedSupply?.id === supply.id ? 'bg-zinc-100' : ''}`}
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-zinc-900 text-sm truncate">{supply.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                      <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span className="text-[9px] font-bold text-zinc-500">{summary.red}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span className="text-[9px] font-bold text-zinc-500">{summary.yellow}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-bold text-zinc-500">{summary.green}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`text-sm font-bold ${supply.currentStock <= supply.minStock ? 'text-red-600' : 'text-zinc-900'}`}>
                                      {supply.currentStock}
                                    </span>
                                    <p className="text-[9px] text-zinc-400 font-medium uppercase">{supply.unit}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Details & History */}
        <div className="lg:col-span-8">
          {selectedSupply ? (
            <div className="flex flex-col gap-6">
              {/* Supply Summary */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Detalles del Insumo</span>
                    <h2 className="text-3xl font-bold text-zinc-900">{selectedSupply.name}</h2>
                    <p className="text-zinc-500 mt-1">{selectedSupply.description || 'Sin descripción'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditSupplyData(selectedSupply);
                        setIsEditingSupply(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                      title="Editar Insumo"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setShowConfirmDelete(true)}
                      disabled={isDeletingSupply}
                      className={`p-2 rounded-xl transition-all ${isDeletingSupply ? 'text-zinc-300' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'}`}
                      title="Eliminar Insumo"
                    >
                      <Trash2 size={18} className={isDeletingSupply ? 'animate-pulse' : ''} />
                    </button>
                    <button
                      onClick={() => { setMovementType('input'); setIsRecordingMovement(true); }}
                      className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-100 transition-colors text-sm font-bold"
                    >
                      <Plus size={18} />
                      Entrada
                    </button>
                    <button
                      onClick={() => { setMovementType('output'); setIsRecordingMovement(true); }}
                      className="bg-red-50 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-red-100 transition-colors text-sm font-bold"
                    >
                      <Minus size={18} />
                      Salida
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Stock Actual</p>
                    <p className={`text-2xl font-bold ${selectedSupply.currentStock <= selectedSupply.minStock ? 'text-red-600' : 'text-zinc-900'}`}>
                      {selectedSupply.currentStock} <span className="text-sm font-medium text-zinc-500">{selectedSupply.unit}</span>
                    </p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Stock Mínimo</p>
                    <p className="text-2xl font-bold text-zinc-900">{selectedSupply.minStock}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Categoría</p>
                    <p className="text-lg font-bold text-zinc-900">{selectedSupply.category}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Unidad</p>
                    <p className="text-lg font-bold text-zinc-900">{selectedSupply.unit}</p>
                  </div>
                </div>

                {/* Active Batches Section */}
                <div className="mt-8">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Lotes Activos</h3>
                  <div className="flex flex-wrap gap-3">
                    {getSupplyBatches(selectedSupply.id).map(b => (
                      <div key={b.batch} className="bg-white border border-zinc-100 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            b.status === 'black' ? 'bg-black' :
                            b.status === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                            b.status === 'yellow' ? 'bg-amber-500' : 
                            'bg-emerald-500'
                          }`} />
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Lote: {b.batch}</p>
                            <p className="text-[10px] text-zinc-500">Stock: {b.currentBalance} • Vence: {b.expirationDate}</p>
                            {b.invimaRecord && <p className="text-[10px] text-zinc-500">INVIMA: {b.invimaRecord}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setBatchToEdit(b);
                              setNewExpirationDate(b.expirationDate);
                              setIsEditingBatch(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                            title="Editar Lote"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setBatchToEdit(b);
                              setIsDeletingBatch(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar Lote"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                    <History size={18} />
                    Historial de Movimientos
                  </h3>
                  <div className="flex bg-zinc-100 p-1 rounded-xl">
                    {(['all', 'input', 'output', 'action'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setHistoryFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          historyFilter === f 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                      >
                        {f === 'all' ? 'Todo' : f === 'input' ? 'Entradas' : f === 'output' ? 'Salidas' : 'Acciones'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                        <th className="px-6 py-4">Fecha Movimiento</th>
                        <th className="px-6 py-4">Fecha Registro</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Cantidad</th>
                        <th className="px-6 py-4">Saldo</th>
                        <th className="px-6 py-4">Responsable</th>
                        <th className="px-6 py-4">Lote/Vence</th>
                        <th className="px-6 py-4">Reg. INVIMA</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 italic">
                            No hay movimientos registrados para este filtro.
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map(entry => (
                          <tr key={entry.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-4 text-zinc-600 font-medium">
                              {formatColombia(entry.date) || 'Pendiente...'}
                            </td>
                            <td className="px-6 py-4 text-zinc-400 text-xs">
                              {formatColombia(entry.createdAt) || 'Pendiente...'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                entry.type === 'input' ? 'bg-emerald-50 text-emerald-700' : 
                                entry.type === 'output' ? 'bg-red-50 text-red-700' : 
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {entry.type === 'input' ? 'Entrada' : entry.type === 'output' ? 'Salida' : `Acción: ${entry.actionType || 'Modificación'}`}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-zinc-900">
                              {entry.type === 'input' ? '+' : '-'}{entry.quantity}
                            </td>
                            <td className="px-6 py-4 font-bold text-zinc-900">
                              {entry.balance}
                            </td>
                            <td className="px-6 py-4 text-zinc-600">
                              {entry.responsible}
                            </td>
                            <td className="px-6 py-4 text-zinc-500 text-xs">
                              {entry.batch && (
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    getBatchStatus(entry.expirationDate) === 'black' ? 'bg-black' :
                                    getBatchStatus(entry.expirationDate) === 'red' ? 'bg-red-500' : 
                                    getBatchStatus(entry.expirationDate) === 'yellow' ? 'bg-amber-500' : 
                                    'bg-emerald-500'
                                  }`} />
                                  <span>Lote: {entry.batch}</span>
                                </div>
                              )}
                              {entry.expirationDate && <div>Vence: {entry.expirationDate}</div>}
                            </td>
                            <td className="px-6 py-4 text-zinc-600 text-xs">
                              {entry.invimaRecord || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white border border-zinc-200 border-dashed rounded-[3rem]">
              <div className="bg-zinc-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 text-zinc-300">
                <ClipboardList size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Seleccione un Insumo</h3>
              <p className="text-zinc-500 max-w-xs">
                Elija un insumo de la lista de la izquierda para ver su historial y gestionar su stock.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Custom Confirmation Modal for Single Supply */}
        {showConfirmDelete && selectedSupply && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mb-6">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">¿Eliminar Insumo?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Estás a punto de eliminar <span className="font-bold text-zinc-900">"{selectedSupply.name}"</span>. 
                {((selectedSupply.currentStock || 0) > 0 || getSupplyBatches(selectedSupply.id).length > 0) ? (
                  <span className="block mt-2 text-red-600 font-medium">
                    ¡ATENCIÓN! Este insumo aún tiene stock o lotes registrados. Se mantendrá el registro en el historial de auditoría.
                  </span>
                ) : (
                  " Esta acción no se puede deshacer, aunque el historial de movimientos se conservará."
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 px-6 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSupply}
                  disabled={isDeletingSupply}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isDeletingSupply ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Custom Confirmation Modal for Database Reset */}
        {showConfirmReset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center mb-6">
                <Trash2 size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">¡REINICIO TOTAL!</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Esta acción <span className="font-bold text-red-600 uppercase">borrará absolutamente todos</span> los insumos y registros de movimientos del sistema. 
                <br /><br />
                Es una acción irreversible diseñada para limpieza de pruebas. ¿Deseas continuar?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 px-6 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetDatabase}
                  disabled={isResetting}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isResetting ? 'Reiniciando...' : 'SÍ, BORRAR TODO'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingSupply && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900">Nuevo Insumo</h2>
                  <button onClick={() => setIsAddingSupply(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddSupply} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre del Insumo</label>
                    <input
                      required
                      type="text"
                      value={newSupply.name}
                      onChange={(e) => setNewSupply({...newSupply, name: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      placeholder="Ej: Tubos de ensayo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Descripción</label>
                    <textarea
                      value={newSupply.description}
                      onChange={(e) => setNewSupply({...newSupply, description: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all h-24 resize-none"
                      placeholder="Uso y especificaciones..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Categoría</label>
                      <select
                        value={newSupply.category}
                        onChange={(e) => setNewSupply({...newSupply, category: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      >
                        <option>Insumo</option>
                        <option>Laboratorio</option>
                        <option>Hemocomponente</option>
                        <option>Reactivos</option>
                        <option>Otros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Unidad</label>
                      <input
                        required
                        type="text"
                        value={newSupply.unit}
                        onChange={(e) => setNewSupply({...newSupply, unit: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                        placeholder="Ej: Unidad, ml"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Stock Mínimo (Alerta)</label>
                    <input
                      required
                      type="number"
                      value={newSupply.minStock}
                      onChange={(e) => setNewSupply({...newSupply, minStock: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-colors mt-4 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Guardar Insumo
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isEditingSupply && editSupplyData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900">Editar Insumo</h2>
                  <button onClick={() => setIsEditingSupply(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditSupply} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre del Insumo</label>
                    <input
                      required
                      type="text"
                      value={editSupplyData.name}
                      onChange={(e) => setEditSupplyData({...editSupplyData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Descripción</label>
                    <textarea
                      value={editSupplyData.description}
                      onChange={(e) => setEditSupplyData({...editSupplyData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all h-24 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Categoría</label>
                      <select
                        value={editSupplyData.category}
                        onChange={(e) => setEditSupplyData({...editSupplyData, category: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      >
                        <option>Insumo</option>
                        <option>Laboratorio</option>
                        <option>Hemocomponente</option>
                        <option>Reactivos</option>
                        <option>Otros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Unidad</label>
                      <input
                        required
                        type="text"
                        value={editSupplyData.unit}
                        onChange={(e) => setEditSupplyData({...editSupplyData, unit: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Stock Mínimo (Alerta)</label>
                    <input
                      required
                      type="number"
                      value={editSupplyData.minStock}
                      onChange={(e) => setEditSupplyData({...editSupplyData, minStock: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-colors mt-4 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Actualizar Insumo
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isRecordingMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900">
                    Registrar {movementType === 'input' ? 'Entrada' : 'Salida'}
                  </h2>
                  <button onClick={() => setIsRecordingMovement(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleRecordMovement} className="space-y-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 mb-4">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Insumo Seleccionado</p>
                    <p className="font-bold text-zinc-900">{selectedSupply?.name}</p>
                    <p className="text-xs text-zinc-500">Stock actual: {selectedSupply?.currentStock} {selectedSupply?.unit}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cantidad</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={movement.quantity}
                        onChange={(e) => setMovement({...movement, quantity: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Responsable</label>
                      <input
                        required
                        type="text"
                        value={movement.responsible}
                        onChange={(e) => setMovement({...movement, responsible: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                        placeholder="Nombre..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Lote</label>
                      {movementType === 'input' ? (
                        <input
                          required
                          type="text"
                          value={movement.batch}
                          onChange={(e) => setMovement({...movement, batch: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                          placeholder="Obligatorio"
                        />
                      ) : (
                        <select
                          required
                          value={movement.batch}
                          onChange={(e) => onBatchSelect(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                        >
                          <option value="">Seleccione Lote</option>
                          {getSupplyBatches(selectedSupply?.id || '').map(b => (
                            <option key={b.batch} value={b.batch}>
                              {b.batch} ({b.currentBalance} disp.)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Vencimiento</label>
                      <input
                        required={movementType === 'input'}
                        disabled={movementType === 'output'}
                        type="date"
                        value={movement.expirationDate}
                        onChange={(e) => setMovement({...movement, expirationDate: e.target.value})}
                        className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all ${movementType === 'output' ? 'opacity-60' : ''}`}
                      />
                    </div>
                  </div>

                  {movementType === 'input' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Registro INVIMA</label>
                      <input
                        type="text"
                        value={movement.invimaRecord}
                        onChange={(e) => setMovement({...movement, invimaRecord: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                        placeholder="Opcional"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Observaciones</label>
                    <textarea
                      value={movement.observations}
                      onChange={(e) => setMovement({...movement, observations: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all h-20 resize-none"
                      placeholder="Detalles adicionales..."
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-4 rounded-2xl font-bold text-white transition-colors mt-4 flex items-center justify-center gap-2 ${movementType === 'input' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    {movementType === 'input' ? <Plus size={20} /> : <Minus size={20} />}
                    Confirmar {movementType === 'input' ? 'Entrada' : 'Salida'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isEditingBatch && batchToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900">Editar Lote</h2>
                  <button onClick={() => setIsEditingBatch(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditBatch} className="space-y-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 mb-4">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Lote Seleccionado</p>
                    <p className="font-bold text-zinc-900">{batchToEdit.batch}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nueva Fecha de Vencimiento</label>
                    <input
                      required
                      type="date"
                      value={newExpirationDate}
                      onChange={(e) => setNewExpirationDate(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Justificación del Cambio</label>
                    <textarea
                      required
                      value={batchJustification}
                      onChange={(e) => setBatchJustification(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all h-24 resize-none"
                      placeholder="Explique por qué se modifica la fecha..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-colors mt-4 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Actualizar Lote
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isDeletingBatch && batchToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8 text-red-600">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={24} />
                    <h2 className="text-2xl font-bold">Eliminar Lote</h2>
                  </div>
                  <button onClick={() => setIsDeletingBatch(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleDeleteBatch} className="space-y-4">
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-4">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">¡Atención!</p>
                    <p className="text-sm text-red-700">Se eliminará el lote <b>{batchToEdit.batch}</b> y se restarán <b>{batchToEdit.currentBalance}</b> unidades del stock total.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Justificación de la Eliminación</label>
                    <textarea
                      required
                      value={batchJustification}
                      onChange={(e) => setBatchJustification(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all h-24 resize-none"
                      placeholder="Explique por qué se elimina este lote (ej: daño, pérdida, error de registro)..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors mt-4 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    Eliminar Lote y Ajustar Stock
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {showConfirmClose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6 text-emerald-600">
                  <div className="flex items-center gap-3">
                    <FileCheck size={24} />
                    <h2 className="text-2xl font-bold">Cerrar Inventario</h2>
                  </div>
                  <button 
                    onClick={() => !isClosingInventory && setShowConfirmClose(false)} 
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                    disabled={isClosingInventory}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6">
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    ¿Está seguro de que desea cerrar el inventario actual? 
                    Esta acción generará un <b>reporte PDF</b> descargable y sincronizará los datos actuales con la hoja de <b>Excel (Inventario)</b>.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmClose(false)}
                    disabled={isClosingInventory}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCloseInventory}
                    disabled={isClosingInventory}
                    className="flex-1 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isClosingInventory ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <FileCheck size={20} />
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
