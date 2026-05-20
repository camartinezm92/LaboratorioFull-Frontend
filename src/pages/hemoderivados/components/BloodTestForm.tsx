import jsPDF from 'jspdf';
import { BloodTestRecord } from '../types';
import { generateInterpretation } from './bloodTestUtils';
import { format } from 'date-fns';

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

const getRhText = (rh: string) => {
  if (rh === '+') return 'POSITIVO';
  if (rh === '-') return 'NEGATIVO';
  return rh;
};

export const generatePDF = async (record: BloodTestRecord) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  try {
    const logoImg = await loadImage('/logo.png');
    const maxWidth = 25; // Reduced from 35
    const maxHeight = 15; // Reduced from 18
    const ratio = Math.min(maxWidth / logoImg.width, maxHeight / logoImg.height);
    const imgWidth = logoImg.width * ratio;
    const imgHeight = logoImg.height * ratio;
    doc.addImage(logoImg, 'PNG', margin, 10, imgWidth, imgHeight);
  } catch (e) {
    console.warn('Logo not found, skipping...');
  }

  doc.setTextColor(0, 0, 0);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Medicna Intensiva del Tolima - UCI Honda', pageWidth / 2, 14, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(' AV Centenario Calle 9 # 22A - 193 - Honda, Tolima Tel: (098) 2517771', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO LABORATORIO', pageWidth / 2, 24, { align: 'center' });

  // Line separator
  doc.setLineWidth(0.5);
  doc.line(margin, 29, pageWidth - margin, 29);

  // Patient Info
  let yPos = 33;
  doc.setFontSize(9);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CC', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.patientId || '', margin + 8, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('USUARIO:', margin + 40, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.patientName || '', margin + 60, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('EPS:', margin + 130, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.eps || '', margin + 140, yPos);

  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Edad:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.age || '', margin + 10, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Sexo:', margin + 25, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.gender || '', margin + 35, yPos);

  yPos += 3;
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // OTROS Section
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('OTROS', margin, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Fecha examen:', margin + 115, yPos);
  doc.text(format(new Date(record.testDate), 'dd/MM/yyyy HH:mm'), margin + 140, yPos);

  yPos += 2;
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // Examen Details
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Examen :', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('PRUEBAS DE COMPATIBILIDAD', margin + 25, yPos);

  yPos += 8;
  const col1 = margin + 25;
  const col2 = margin + 65;
  const col3 = margin + 105;
  const col4 = margin + 145;

  doc.setFont('helvetica', 'normal');
  doc.text('NUMERO DE UNIDAD', col1, yPos);
  doc.text('SELLO DE CALIDAD', col2, yPos);
  doc.text('GRUPO DE UNIDAD', col3, yPos);
  doc.text('FECHA VENCIMIENTO', col4, yPos);

  yPos += 4;
  doc.text(record.unitId || record.hemoderivativeUnit || '', col1, yPos);
  doc.text(record.qualitySeal || '', col2, yPos);
  doc.text(`${record.unitGroup || ''} ${getRhText(record.unitRh || '')}`, col3, yPos);
  doc.text(record.unitExpirationDate || '', col4, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('GRUPO PACIENTE (INMUNOHEMATOLOGÍA)', col1, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 4;
  doc.text(`Resultado: ${record.bloodGroup || ''}${record.rh || ''}`, col1, yPos);
  doc.text(`Fórmula: [A: ${record.patientBloodA || '0'} | B: ${record.patientBloodB || '0'} | AB: ${record.patientBloodAB || '0'} | D: ${record.patientBloodD || '+'}]`, col1 + 40, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('RASTREO DE ANTICUERPOS IRREGULARES (POR FASES)', col1, yPos);
  doc.setFont('helvetica', 'normal');
  
  yPos += 4;
  doc.text(`F. SALINA     -> Prueba: ${record.salinaPruebaCruzada || '0'} | Autocontrol: ${record.salinaAutocontrol || '0'} | Temp: ${record.salinaTemperatura || 'TA'}`, col1, yPos);
  yPos += 4;
  doc.text(`F. INCUBACIÓN -> Prueba: ${record.incubacionPruebaCruzada || '0'} | Autocontrol: ${record.incubacionAutocontrol || '0'} | Temp: ${record.incubacionTemperatura || '37°C'}`, col1, yPos);
  yPos += 4;
  doc.text(`F. PROTEICA   -> Prueba: ${record.proteicaPruebaCruzada || '0'} | Autocontrol: ${record.proteicaAutocontrol || '0'} | Temp: ${record.proteicaTemperatura || '37°C'}`, col1, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`RESULTADO: ${record.result.toUpperCase()}`, col1, yPos);
  
  // Interpretation
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const predefinedText = generateInterpretation(record);

  const splitPredefined = doc.splitTextToSize(predefinedText, pageWidth - col1 - margin);
  doc.text(splitPredefined, col1, yPos);
  yPos += (splitPredefined.length * 4) + 2;

  // SIHEVI Section in PDF
  if (record.siheviReport === 'Sí' || record.siheviPredefinedText) {
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN SIHEVI:', col1, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Reporte SIHEVI: ${record.siheviReport || 'No'}`, col1, yPos);
    if (record.siheviDescription) {
      doc.text(` - ${record.siheviDescription}`, col1 + 40, yPos);
    }
    yPos += 4;
    if (record.siheviPredefinedText) {
      const siheviText = `Comentario: ${record.siheviPredefinedText}`;
      const splitSihevi = doc.splitTextToSize(siheviText, pageWidth - col1 - margin);
      doc.text(splitSihevi, col1, yPos);
      yPos += (splitSihevi.length * 4);
    }
    yPos += 2;
  }

  // Signature
  yPos += 20; // Increased space from previous text to avoid overlap
  let signatureHeight = 15;
  try {
    const { PROFESSIONALS } = await import('../../../constants');
    const professional = PROFESSIONALS.find(p => p.name === record.bacteriologist) || PROFESSIONALS[1];
    let firmaImg;
    try {
      firmaImg = await loadImage(professional.signaturePath);
    } catch (e) {
      console.warn(`Signature ${professional.signaturePath} not found, falling back to /firma1.png`);
      firmaImg = await loadImage('/firma1.png');
    }
    const imgWidth = 20; // Reduced from 30
    signatureHeight = (firmaImg.height * imgWidth) / firmaImg.width;
    if (signatureHeight > 15) signatureHeight = 15; // Reduced max height
    
    // Place signature above the line
    doc.addImage(firmaImg, 'PNG', col1, yPos - signatureHeight, imgWidth, signatureHeight);
  } catch (e) {
    console.warn('Firma not found, skipping...');
  }
  
  doc.line(col1 - 10, yPos + 1, col1 + 60, yPos + 1); // Signature line

  yPos += 8;
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // Footer / Professional Info
  yPos += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Bacteriologo:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.bacteriologist || 'Dr. Luis Valeriano', margin + 25, yPos);

  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Registro:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.registryNumber || '111', margin + 25, yPos);

  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Usuario:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(record.userEmail?.split('@')[0].toUpperCase() || 'SISTEMA', margin + 15, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Impreso el:', margin + 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), margin + 100, yPos);

  doc.text('Página 1 de 1', pageWidth - margin - 20, yPos);

  doc.save(`PrueCru-${record.patientId || 'SIN_ID'}-${(record.patientName || 'SIN_NOMBRE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}-${format(new Date(record.testDate), 'yyMMdd')}.pdf`);
};

export const generateTraceabilityPDF = async (data: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 15;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  // Header
  try {
    const logoImg = await loadImage('/logo.png');
    const maxWidth = 35;
    const maxHeight = 18;
    const ratio = Math.min(maxWidth / logoImg.width, maxHeight / logoImg.height);
    const imgWidth = logoImg.width * ratio;
    const imgHeight = logoImg.height * ratio;
    doc.addImage(logoImg, 'PNG', margin, yPos, imgWidth, imgHeight);
  } catch (e) {
    console.warn('Logo not found, skipping...');
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Trazabilidad de Hemoderivado', pageWidth / 2, yPos + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Unidad / Sello: ${data.unitId}`, pageWidth / 2, yPos + 14, { align: 'center' });
  
  yPos += 25;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  const renderSection = (title: string, records: any[], renderRecord: (record: any) => void) => {
    if (!records || records.length === 0) return;

    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text(title, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    records.forEach((record, index) => {
      checkPageBreak(30);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Registro ${index + 1} - ${format(new Date(record.createdAt), 'dd/MM/yyyy HH:mm')}`, margin + 5, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      renderRecord(record);
      yPos += 5;
    });
    
    yPos += 5;
  };

  // 1. Recepción
  renderSection('1. Recepción', data.records.receivedUnits, (record) => {
    doc.text(`Sello de Calidad: ${record.qualitySeal || 'N/A'}`, margin + 10, yPos);
    yPos += 5;
    doc.text(`Tipo: ${record.hemoderivativeType || 'N/A'}`, margin + 10, yPos);
    doc.text(`Grupo/Rh: ${record.bloodGroup || ''}${record.rh || ''}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Proveedor: ${record.provider || 'N/A'}`, margin + 10, yPos);
    doc.text(`Vencimiento: ${record.expirationDate || 'N/A'}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Aceptado: ${record.accepted || 'N/A'}`, margin + 10, yPos);
    if (record.accepted === 'No') {
      doc.text(`Motivo Rechazo: ${record.rejectionReason || 'N/A'}`, margin + 80, yPos);
    }
    yPos += 5;
    doc.text(`Registrado por: ${record.userEmail || 'N/A'}`, margin + 10, yPos);
  });

  // 2. Pruebas Cruzadas
  renderSection('2. Pruebas Pre-transfusionales', data.records.bloodTestRecords, (record) => {
    doc.text(`Paciente: ${record.patientName || 'N/A'} (ID: ${record.patientId || 'N/A'})`, margin + 10, yPos);
    yPos += 5;
    doc.text(`Grupo Paciente: ${record.bloodGroup || ''}${record.rh || ''}`, margin + 10, yPos);
    doc.text(`Tipo Solicitud: ${record.requestType || 'N/A'}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Resultado: ${record.result || 'N/A'}`, margin + 10, yPos);
    doc.text(`Anticuerpos: ${record.irregularAntibodies || 'N/A'}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Autocontrol: ${record.autocontrol || 'N/A'}`, margin + 10, yPos);
    doc.text(`Responsable: ${record.bacteriologist || record.responsiblePerson || 'N/A'}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Registrado por: ${record.userEmail || 'N/A'}`, margin + 10, yPos);
  });

  // 3. Uso / Transfusión
  renderSection('3. Uso y Transfusión', data.records.transfusionUse, (record) => {
    doc.text(`Paciente: ${record.patientName || 'N/A'} (ID: ${record.patientId || 'N/A'})`, margin + 10, yPos);
    yPos += 5;
    doc.text(`Servicio: ${record.service || 'N/A'}`, margin + 10, yPos);
    doc.text(`Fecha Transfusión: ${record.transfusionDate || 'N/A'} ${record.transfusionTime || ''}`, margin + 80, yPos);
    yPos += 5;
    doc.text(`Reacción Adversa: ${record.adverseReaction || 'No'}`, margin + 10, yPos);
    doc.text(`Oportunidad: ${record.opportunity || 'N/A'}`, margin + 80, yPos);
    if (record.adverseReaction === 'Sí') {
      yPos += 5;
      doc.text(`Descripción Reacción: ${record.reactionDescription || 'N/A'}`, margin + 10, yPos);
    }
    yPos += 5;
    doc.text(`Registrado por: ${record.userEmail || 'N/A'}`, margin + 10, yPos);
  });

  // 4. Disposición Final
  renderSection('4. Disposición Final', data.records.finalDisposition, (record) => {
    doc.text(`Motivo de Disposición: ${record.dispositionType || 'N/A'}`, margin + 10, yPos);
    yPos += 5;
    doc.text(`Fecha: ${record.dispositionDate || 'N/A'}`, margin + 10, yPos);
    doc.text(`Responsable: ${record.responsiblePerson || 'N/A'}`, margin + 80, yPos);
    if (record.reason) {
      yPos += 5;
      doc.text(`Observaciones: ${record.reason}`, margin + 10, yPos);
    }
    if (record.observations) {
      yPos += 5;
      doc.text(`Notas Adicionales: ${record.observations}`, margin + 10, yPos);
    }
    yPos += 5;
    doc.text(`Registrado por: ${record.userEmail || 'N/A'}`, margin + 10, yPos);
  });

  // Footer
  checkPageBreak(30);
  yPos += 10;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, margin, yPos);
  doc.text('Sistema de Gestión de Hemoderivados - UCI Honda', pageWidth - margin, yPos, { align: 'right' });

  doc.save(`Trazabilidad-${data.unitId}-${format(new Date(), 'yyMMdd-HHmm')}.pdf`);
};
