import React, { useState, useEffect } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Función para abrir IndexedDB
const openDb = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pdfDatabase', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore('pdfs', { keyPath: 'name' });
      store.createIndex('name', 'name', { unique: true });
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject('Error al abrir la base de datos: ' + event.target.error);
    };
  });
};

// Función para almacenar PDFs en IndexedDB
const storePdf = async (name, base64) => {
  const db = await openDb();
  const transaction = db.transaction('pdfs', 'readwrite');
  const store = transaction.objectStore('pdfs');
  
  const pdfData = { name, base64 };
  const request = store.put(pdfData);

  request.onsuccess = () => {
    console.log('PDF guardado correctamente en IndexedDB');
  };

  request.onerror = (event) => {
    console.error('Error al guardar el PDF:', event.target.error);
  };
};

// Función para obtener un PDF de IndexedDB
const getPdf = async (name) => {
  const db = await openDb();
  const transaction = db.transaction('pdfs', 'readonly');
  const store = transaction.objectStore('pdfs');
  
  const request = store.get(name);

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const pdf = event.target.result;
      if (pdf) {
        resolve(pdf);
        console.log("pdf obtenido de indexDB");
      } else {
        reject('PDF no encontrado');
      }
    };

    request.onerror = (event) => {
      reject('Error al obtener el PDF: ' + event.target.error);
    };
  });
};

const App = () => {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [outputFileName, setOutputFileName] = useState("combinado.pdf");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDefaultPDFs = async () => {
      const modules = import.meta.glob("../assets/pdfs/*.pdf", { as: "url" });
      const loadedFiles = [];

      // Cargar los archivos predeterminados
      for (const [path, getUrl] of Object.entries(modules)) {
        const url = await getUrl();
        const name = path.split("/").pop();

        const response = await fetch(url);
        const blob = await response.blob();

        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        loadedFiles.push({ name, base64 });
      }

      // Cargar archivos desde IndexedDB
      try {
        const storedFiles = [];
        const db = await openDb();
        const transaction = db.transaction('pdfs', 'readonly');
        const store = transaction.objectStore('pdfs');
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            storedFiles.push({ name: cursor.value.name, base64: cursor.value.base64 });
            cursor.continue();
          } else {
            const allFiles = [...loadedFiles, ...storedFiles];
            setPdfFiles(allFiles);
            setIsLoading(false);
          }
        };

        cursorRequest.onerror = (event) => {
          console.error('Error al leer IndexedDB:', event.target.error);
          setIsLoading(false);
        };
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    };

    loadDefaultPDFs();
  }, []);

  const handlePdfUpload = (event) => {
    const files = event.target.files;
    const newFiles = [...pdfFiles];
    let processed = 0;

    setIsLoading(true);

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Pdf = reader.result;

        // Almacenar el PDF en IndexedDB
        await storePdf(file.name, base64Pdf);

        // Añadir el archivo a la lista en memoria
        newFiles.push({ name: file.name, base64: base64Pdf });
        processed++;

        if (processed === files.length) {
          setPdfFiles(newFiles);
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSelectFile = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedFiles(selected);
  };

  const handleReorder = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const reorderedFiles = Array.from(selectedFiles);
    const [removed] = reorderedFiles.splice(source.index, 1);
    reorderedFiles.splice(destination.index, 0, removed);

    setSelectedFiles(reorderedFiles);
  };

  const sanitizeText = (text) => {
    return text.replace(/[^\x00-\x7F]/g, ""); // Elimina caracteres no ASCII
  };
  
  const handleCreatePdf = async () => {
    try {
      console.log("Se empieza a crear el pdf");
      const pdfDoc = await PDFDocument.create();
      const indexPage = pdfDoc.addPage();
      const indexPageWidth = indexPage.getWidth();
      const indexPageHeight = indexPage.getHeight();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pageHeight = indexPageHeight - 50;
      let yPosition = pageHeight;
  
      indexPage.drawText("ÍNDICE", {
        x: 50,
        y: yPosition,
        font,
        size: 14,
      });
      yPosition -= 20;
  
      console.log("indice creado");

      selectedFiles.forEach((file, index) => {
        const sanitizedFileName = sanitizeText(file);
        indexPage.drawText(`${index + 1}. ${sanitizedFileName}`, {
          x: 50,
          y: yPosition,
          font,
          size: 12,
        });
        yPosition -= 20;
        console.log("pdf añadido");
      });

      // Agregar un salto de página
      indexPage.drawText("\n", {
        x: 50,
        y: yPosition - 20,
        font,
        size: 12,
      });

          // Combinamos los PDFs seleccionados
        for (const file of selectedFiles) {
          const pdfFile = pdfFiles.find((pdf) => pdf.name === file);
          const existingPdfBytes = await fetch(pdfFile.base64).then(res => res.arrayBuffer());
          const existingPdfDoc = await PDFDocument.load(existingPdfBytes);
          const copiedPages = await pdfDoc.copyPages(existingPdfDoc, existingPdfDoc.getPageIndices());
          copiedPages.forEach((page) => pdfDoc.addPage(page));
        }

        // Guardar el nuevo PDF
        const pdfBytes = await pdfDoc.save();
        const newPdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        const newPdfUrl = URL.createObjectURL(newPdfBlob);

        // Crear un enlace para descargar el PDF combinado
        const link = document.createElement("a");
        link.href = newPdfUrl;
        link.download = outputFileName; // Nombre del archivo ingresado por el usuario
        link.click();
  
      // El resto del código sigue igual...
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Hubo un error al generar el PDF. Por favor, intenta nuevamente.");
    }
  };

  const handleClearPdfs = () => {
    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar todos los PDFs subidos?");
    if (!confirmed) return;

    setPdfFiles([]);
    setSelectedFiles([]);
    setOutputFileName("pdf_combinado.pdf");

    // Limpiar los PDFs de IndexedDB
    openDb().then(db => {
      const transaction = db.transaction('pdfs', 'readwrite');
      const store = transaction.objectStore('pdfs');
      store.clear();
    }).catch(console.error);
  };

  const handleSelectAll = () => {
    setSelectedFiles(pdfFiles.map((file) => file.name));
  };

  const handleDeselectAll = () => {
    setSelectedFiles([]);
  };

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>Sube tus PDFs</h1>

      <input
        type="file"
        accept="application/pdf"
        onChange={handlePdfUpload}
        multiple
        style={{ display: 'block', margin: '0 auto', marginBottom: '20px' }}
        disabled={isLoading}
      />

      {isLoading && <p style={{ color: 'blue', textAlign: 'center' }}>Cargando PDFs, por favor espera...</p>}

      <h2>Selecciona los PDFs para combinar (puedes cambiar el orden):</h2>

      <button onClick={handleSelectAll} disabled={isLoading}>Seleccionar todos</button>
      <button onClick={handleDeselectAll} style={{ marginLeft: '10px' }} disabled={isLoading}>Deseleccionar todos</button>

      <DragDropContext onDragEnd={handleReorder}>
        <Droppable droppableId="droppable">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{
                listStyleType: 'none',
                padding: 0,
                margin: '20px 0',
                minHeight: '200px',
              }}
            >
              {selectedFiles.map((file, index) => (
                <Draggable key={file} draggableId={file} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        padding: '10px',
                        marginBottom: '10px',
                        background: '#f4f4f4',
                        borderRadius: '5px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {file}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      <select multiple onChange={handleSelectFile} style={{ width: '100%', padding: '10px', marginBottom: '20px' }} disabled={isLoading}>
        {pdfFiles.map((pdf, index) => (
          <option key={index} value={pdf.name}>
            {pdf.name}
          </option>
        ))}
      </select>

      <p style={{ marginTop: '10px', fontStyle: 'italic', color: '#555' }}>
        Hay {pdfFiles.length} PDF{pdfFiles.length !== 1 ? 's' : ''} cargado{pdfFiles.length !== 1 ? 's' : ''} en memoria.
      </p>

      <button
        onClick={handleClearPdfs}
        style={{
          marginTop: '10px',
          backgroundColor: 'red',
          color: 'white',
          padding: '8px 12px',
          border: 'none',
          borderRadius: '6px',
        }}
        disabled={isLoading}
      >
        Eliminar todos los PDFs
      </button>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="outputFileName" style={{ display: 'block' }}>Nombre del archivo generado:</label>
        <input
          type="text"
          id="outputFileName"
          value={outputFileName}
          onChange={(e) => setOutputFileName(e.target.value)}
          placeholder="Introduce el nombre del archivo"
          style={{ width: '100%', padding: '10px' }}
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleCreatePdf}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
        }}
        disabled={isLoading || selectedFiles.length === 0}
      >
        Crear PDF combinado
      </button>

      {selectedFiles.length > 0 && (
        <div>
          <h3>Archivos seleccionados:</h3>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index}>{file}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
