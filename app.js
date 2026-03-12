const MAX_CANVAS_WIDTH = 1000;
const MAX_CANVAS_HEIGHT = 700;
const STORAGE_KEY = 'ocrLayoutProfiles';

const canvas = new fabric.Canvas('canvas', {
  preserveObjectStacking: true,
  selection: true
});

const upload = document.getElementById('upload');
const profileName = document.getElementById('profileName');
const slotButtons = [...document.querySelectorAll('.slot-btn')];
const assignBox = document.getElementById('assignBox');
const columnTypeSelect = document.getElementById('columnTypeSelect');
const btnApplyType = document.getElementById('btnApplyType');
const btnCancelType = document.getElementById('btnCancelType');
const statusBox = document.getElementById('status');
const resultsBody = document.querySelector('#resultsTable tbody');

let profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
if (!Array.isArray(profiles) || profiles.length !== 4) {
  profiles = [null, null, null, null];
}

let activeSlot = 0;
let originalImage = null;
let baseImageObject = null;
let imageScale = 1;
let results = [];
let pendingColumn = null;

function setStatus(message) {
  statusBox.textContent = message;
}

function persistProfiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function refreshSlotButtons() {
  slotButtons.forEach((button, index) => {
    button.classList.toggle('active', index === activeSlot);
    button.textContent = profiles[index]?.name || `Bolsillo ${index + 1}`;
  });
  profileName.value = profiles[activeSlot]?.name || '';
}

function getPalette(kind, columnType) {
  if (kind === 'area') {
    return { stroke: '#fb8c00', fill: 'rgba(251,140,0,0.12)' };
  }
  if (kind === 'column' && columnType === 'id') {
    return { stroke: '#1a73e8', fill: 'rgba(26,115,232,0.12)' };
  }
  if (kind === 'column' && columnType === 'name') {
    return { stroke: '#2e7d32', fill: 'rgba(46,125,50,0.12)' };
  }
  return { stroke: '#6b7280', fill: 'rgba(107,114,128,0.12)' };
}

function applyRectStyle(rect) {
  const palette = getPalette(rect.kind, rect.columnType);
  rect.set({
    fill: palette.fill,
    stroke: palette.stroke,
    strokeWidth: 2,
    transparentCorners: false,
    cornerColor: palette.stroke,
    cornerStyle: 'circle',
    borderColor: palette.stroke,
    hasRotatingPoint: false,
    lockRotation: true
  });
}

function makeRect(kind, columnType, props = {}) {
  const rect = new fabric.Rect({
    left: 60,
    top: 60,
    width: 160,
    height: 260,
    kind,
    columnType: columnType || null,
    ...props
  });
  applyRectStyle(rect);
  return rect;
}

function hideAssignBox() {
  pendingColumn = null;
  assignBox.classList.add('hidden');
}

function removeOverlayRects() {
  canvas.getObjects().forEach(obj => {
    if (obj.type === 'rect') {
      canvas.remove(obj);
    }
  });
}

function clearOverlayRects() {
  removeOverlayRects();
  canvas.discardActiveObject();
  hideAssignBox();
  canvas.requestRenderAll();
}

function getAreaObject() {
  return canvas.getObjects().find(obj => obj.type === 'rect' && obj.kind === 'area') || null;
}

function getColumnRects() {
  return canvas.getObjects().filter(obj => obj.type === 'rect' && obj.kind === 'column');
}

function getColumnObjects(type) {
  return getColumnRects().filter(obj => obj.columnType === type);
}

function getExistingTypes(excludeObj = null) {
  return new Set(
    getColumnRects()
      .filter(obj => obj !== excludeObj && obj.columnType)
      .map(obj => obj.columnType)
  );
}

function getMissingTypes(excludeObj = null) {
  const existing = getExistingTypes(excludeObj);
  return ['id', 'name'].filter(type => !existing.has(type));
}

function addAreaRect() {
  canvas.getObjects()
    .filter(obj => obj.type === 'rect' && obj.kind === 'area')
    .forEach(obj => canvas.remove(obj));

  const rect = makeRect('area', null, {
    left: 40,
    top: 40,
    width: 320,
    height: 420
  });

  canvas.add(rect);
  canvas.setActiveObject(rect);
  canvas.requestRenderAll();
  setStatus('Área de búsqueda creada. Puedes moverla o redimensionarla.');
}

function showAssignBox(rect) {
  pendingColumn = rect;
  const missing = getMissingTypes(rect);
  columnTypeSelect.value = missing.includes('id') ? 'id' : 'name';
  assignBox.classList.remove('hidden');
  setStatus('Selecciona en la lista si la nueva columna corresponde a identificación o nombre.');
}

function assignColumnType(rect, type) {
  rect.columnType = type;
  applyRectStyle(rect);
  hideAssignBox();
  canvas.setActiveObject(rect);
  canvas.requestRenderAll();
  setStatus(`Columna asignada como ${type === 'id' ? 'Identificación' : 'Nombre'}.`);
}

function addGenericColumn() {
  const columns = getColumnRects();

  if (columns.length >= 2) {
    alert('En esta etapa solo se permiten dos columnas: una de identificación y una de nombre.');
    return;
  }

  const rect = makeRect('column', null, {
    left: columns.length === 0 ? 90 : 320,
    top: 80,
    width: 180,
    height: 360
  });

  canvas.add(rect);
  canvas.setActiveObject(rect);
  canvas.requestRenderAll();

  const missing = getMissingTypes(rect);

  if (missing.length === 1) {
    assignColumnType(rect, missing[0]);
    setStatus(`La segunda columna fue asignada automáticamente como ${missing[0] === 'id' ? 'Identificación' : 'Nombre'}.`);
  } else {
    showAssignBox(rect);
  }
}

function serializeLayout() {
  return canvas.getObjects()
    .filter(obj => obj.type === 'rect')
    .map(obj => ({
      kind: obj.kind,
      columnType: obj.columnType || null,
      left: obj.left,
      top: obj.top,
      width: obj.width,
      height: obj.height,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1
    }));
}

function renderProfile(slot) {
  removeOverlayRects();
  hideAssignBox();

  const profile = profiles[slot];
  if (!profile?.layout) {
    canvas.requestRenderAll();
    return;
  }

  profile.layout.forEach(item => {
    const rect = makeRect(item.kind, item.columnType, {
      left: item.left,
      top: item.top,
      width: item.width,
      height: item.height,
      scaleX: item.scaleX || 1,
      scaleY: item.scaleY || 1
    });
    canvas.add(rect);
  });

  canvas.requestRenderAll();
}

function boxFromRect(rect) {
  return {
    x: Math.max(0, Math.round(rect.left / imageScale)),
    y: Math.max(0, Math.round(rect.top / imageScale)),
    w: Math.max(1, Math.round((rect.width * (rect.scaleX || 1)) / imageScale)),
    h: Math.max(1, Math.round((rect.height * (rect.scaleY || 1)) / imageScale))
  };
}

function intersectBoxes(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);

  return r > x && bottom > y
    ? { x, y, w: r - x, h: bottom - y }
    : null;
}

function cropBoxToDataUrl(box) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = box.w;
  tempCanvas.height = box.h;

  const ctx = tempCanvas.getContext('2d');
  ctx.drawImage(originalImage, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

  return tempCanvas.toDataURL('image/png');
}

async function recognizeLines(box, type) {
  const imageDataUrl = cropBoxToDataUrl(box);
  const lang = type === 'id' ? 'eng' : 'spa+eng';

  const result = await Tesseract.recognize(imageDataUrl, lang, {
    logger: msg => {
      if (msg.status) {
        setStatus(`OCR ${type === 'id' ? 'identificación' : 'nombre'}: ${msg.status}`);
      }
    }
  });

  const lines = result.data?.lines?.length
    ? result.data.lines
    : [{
        text: result.data?.text || '',
        bbox: { y0: 0, y1: box.h },
        confidence: result.data?.confidence || 0
      }];

  return lines
    .map(line => {
      const raw = (line.text || '').replace(/\s+/g, ' ').trim();
      const clean = type === 'id' ? raw.replace(/[^0-9]/g, '') : raw;
      const y0 = line.bbox?.y0 || 0;
      const y1 = line.bbox?.y1 || box.h;
      const yLocal = y0 + ((y1 - y0) / 2);

      return {
        raw,
        clean,
        conf: Math.round(line.confidence || line.conf || result.data?.confidence || 0),
        y: box.y + yLocal
      };
    })
    .filter(item => type === 'id' ? item.raw.length > 0 : item.clean.length > 0)
    .sort((a, b) => a.y - b.y);
}

function pairByY(idLines, nameLines) {
  const ids = [...idLines].sort((a, b) => a.y - b.y);
  const names = [...nameLines].sort((a, b) => a.y - b.y);
  const usedNames = new Set();
  const pairs = [];

  ids.forEach(idLine => {
    let bestIndex = -1;
    let bestDiff = Infinity;

    names.forEach((nameLine, index) => {
      if (usedNames.has(index)) return;
      const diff = Math.abs(nameLine.y - idLine.y);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestDiff < 120) {
      usedNames.add(bestIndex);
      pairs.push({ id: idLine, name: names[bestIndex] });
    } else {
      pairs.push({ id: idLine, name: null });
    }
  });

  names.forEach((nameLine, index) => {
    if (!usedNames.has(index)) {
      pairs.push({ id: null, name: nameLine });
    }
  });

  return pairs.sort((a, b) => {
    const ay = a.id?.y || a.name?.y || 0;
    const by = b.id?.y || b.name?.y || 0;
    return ay - by;
  });
}

function renderResults() {
  resultsBody.innerHTML = '';

  results.forEach(row => {
    const tr = document.createElement('tr');

    [
      'Identificación',
      'Nombre',
      'Perfil usado',
      'Índice de fila',
      'Texto OCR bruto de identificación',
      'Texto OCR bruto de nombre',
      'Confianza OCR identificación',
      'Confianza OCR nombre',
      'Observaciones'
    ].forEach(key => {
      const td = document.createElement('td');
      td.textContent = row[key] ?? '';
      tr.appendChild(td);
    });

    resultsBody.appendChild(tr);
  });
}

function drawLoadedImage(img) {
  originalImage = img;
  imageScale = Math.min(1, MAX_CANVAS_WIDTH / img.naturalWidth, MAX_CANVAS_HEIGHT / img.naturalHeight);

  canvas.clear();
  hideAssignBox();
  baseImageObject = null;

  canvas.setDimensions({
    width: Math.round(img.naturalWidth * imageScale),
    height: Math.round(img.naturalHeight * imageScale)
  });

  baseImageObject = new fabric.Image(img, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: imageScale,
    scaleY: imageScale,
    selectable: false,
    evented: false,
    hoverCursor: 'default'
  });

  canvas.add(baseImageObject);
  canvas.sendToBack(baseImageObject);
  renderProfile(activeSlot);
  canvas.calcOffset();
  canvas.requestRenderAll();

  setStatus('Imagen cargada y visible en el lienzo.');
}

function loadImageFromUrl(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    drawLoadedImage(img);
  };

  img.onerror = () => {
    setStatus(`No se pudo cargar la imagen: ${url}`);
  };

  img.src = url;
}

function loadImage(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = event => {
    loadImageFromUrl(event.target.result);
  };

  reader.onerror = () => {
    setStatus('No se pudo leer el archivo seleccionado.');
  };

  reader.readAsDataURL(file);
}

async function loadImageFromPath(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' });

    if (!response.ok) {
      setStatus(`No se encontró la imagen automática: ${path}`);
      return;
    }

    loadImageFromUrl(path + '?v=' + Date.now());
  } catch (error) {
    setStatus(`Error cargando imagen automática: ${error.message}`);
  }
}

async function runOCR() {
  if (!originalImage) {
    alert('Primero carga una imagen.');
    return;
  }

  const idRect = getColumnObjects('id')[0];
  const nameRect = getColumnObjects('name')[0];

  if (!idRect || !nameRect) {
    alert('Debes tener exactamente una columna de Identificación y una de Nombre antes de ejecutar OCR.');
    return;
  }

  const areaObj = getAreaObject();
  const areaBox = areaObj ? boxFromRect(areaObj) : null;

  let idBox = boxFromRect(idRect);
  let nameBox = boxFromRect(nameRect);

  if (areaBox) {
    idBox = intersectBoxes(idBox, areaBox);
    nameBox = intersectBoxes(nameBox, areaBox);
  }

  if (!idBox || !nameBox) {
    alert('Las columnas quedaron fuera del área de búsqueda.');
    return;
  }

  setStatus('Iniciando OCR...');

  const idLines = await recognizeLines(idBox, 'id');
  const nameLines = await recognizeLines(nameBox, 'name');
  const pairs = pairByY(idLines, nameLines);

  const profileLabel = profiles[activeSlot]?.name || `Bolsillo ${activeSlot + 1}`;

  results = pairs.map((pair, index) => ({
    'Identificación': pair.id ? pair.id.clean : '',
    'Nombre': pair.name ? pair.name.clean : '',
    'Perfil usado': profileLabel,
    'Índice de fila': index + 1,
    'Texto OCR bruto de identificación': pair.id ? pair.id.raw : '',
    'Texto OCR bruto de nombre': pair.name ? pair.name.raw : '',
    'Confianza OCR identificación': pair.id ? pair.id.conf : '',
    'Confianza OCR nombre': pair.name ? pair.name.conf : '',
    'Observaciones': pair.id && pair.name
      ? 'Emparejado por cercanía vertical'
      : pair.id
        ? 'Falta nombre emparejado'
        : 'Falta identificación emparejada'
  }));

  renderResults();
  setStatus(`OCR finalizado. Registros detectados: ${results.length}`);
}

function exportResults() {
  if (!results.length) {
    alert('No hay resultados para exportar.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(results);

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
  XLSX.writeFile(workbook, 'resultado_ocr_layout.xlsx');

  setStatus('Archivo XLSX exportado.');
}

document.getElementById('btnAddArea').addEventListener('click', addAreaRect);
document.getElementById('btnAddColumn').addEventListener('click', addGenericColumn);

document.getElementById('btnDeleteSelected').addEventListener('click', () => {
  const activeObject = canvas.getActiveObject();

  if (activeObject && activeObject.type === 'rect') {
    if (pendingColumn === activeObject) {
      hideAssignBox();
    }
    canvas.remove(activeObject);
    canvas.requestRenderAll();
    setStatus('Elemento eliminado.');
  }
});

document.getElementById('btnClearLayout').addEventListener('click', () => {
  clearOverlayRects();
  setStatus('Layout limpiado.');
});

document.getElementById('btnSaveProfile').addEventListener('click', () => {
  const layout = serializeLayout();
  const typedColumns = layout.filter(item => item.kind === 'column' && item.columnType);

  if (typedColumns.length > 2) {
    alert('Solo se permiten dos columnas en esta etapa.');
    return;
  }

  profiles[activeSlot] = {
    name: profileName.value.trim() || `Bolsillo ${activeSlot + 1}`,
    layout
  };

  persistProfiles();
  refreshSlotButtons();
  setStatus(`Perfil guardado en el bolsillo ${activeSlot + 1}.`);
});

document.getElementById('btnRunOCR').addEventListener('click', runOCR);
document.getElementById('btnExport').addEventListener('click', exportResults);

btnApplyType.addEventListener('click', () => {
  if (!pendingColumn) return;
  assignColumnType(pendingColumn, columnTypeSelect.value);
});

btnCancelType.addEventListener('click', () => {
  if (pendingColumn) {
    canvas.remove(pendingColumn);
    canvas.requestRenderAll();
  }
  hideAssignBox();
  setStatus('Columna cancelada.');
});

upload.addEventListener('change', event => {
  loadImage(event.target.files[0]);
});

slotButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeSlot = Number(button.dataset.slot);
    refreshSlotButtons();

    if (originalImage) {
      renderProfile(activeSlot);
    }

    setStatus('Perfil activo cambiado.');
  });
});

refreshSlotButtons();
canvas.setDimensions({ width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT });
setStatus('Intentando cargar test.jpeg desde la raíz...');
loadImageFromPath('test.jpeg');
