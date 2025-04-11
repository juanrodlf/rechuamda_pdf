import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib"; // Asegúrate de tener pdf-lib instalada
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd"; // Importar la librería de drag-and-drop

const App = () => {
  const [pdfFiles, setPdfFiles] = useState([]); // Almacena los PDFs disponibles
  const [selectedFiles, setSelectedFiles] = useState([]); // Almacena los PDFs seleccionados para combinar
  const [outputFileName, setOutputFileName] = useState("combinado.pdf"); // Nombre del archivo generado

  useEffect(() => {
    // Cargar los PDFs almacenados en localStorage cuando la app se inicie
    const storedFiles = JSON.parse(localStorage.getItem("pdfFiles")) || [];
    setPdfFiles(storedFiles);
  }, []);

  const handlePdfUpload = (event) => {
    const files = event.target.files;
    const newFiles = [...pdfFiles];

    // Convertir los archivos PDF seleccionados a base64 para almacenarlos
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Pdf = reader.result;
        newFiles.push({ name: file.name, base64: base64Pdf });

        // Actualizar el estado y el localStorage
        setPdfFiles(newFiles);
        localStorage.setItem("pdfFiles", JSON.stringify(newFiles));
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
    if (!destination) return; // No hacer nada si no hay destino

    // Reordenar los archivos seleccionados
    const reorderedFiles = Array.from(selectedFiles);
    const [removed] = reorderedFiles.splice(source.index, 1);
    reorderedFiles.splice(destination.index, 0, removed);

    setSelectedFiles(reorderedFiles);
  };

  const handleCreatePdf = async () => {
    // Crear un nuevo PDF combinado
    const pdfDoc = await PDFDocument.create();

    // Crear la página del índice (primer página)
    const indexPage = pdfDoc.addPage();
    const indexPageWidth = indexPage.getWidth();
    const indexPageHeight = indexPage.getHeight();
    const font = await pdfDoc.embedFont(PDFDocument.Font.Helvetica);
    const pageHeight = indexPageHeight - 50; // Margen superior
    let yPosition = pageHeight;

    // Escribir el índice en la primera página
    indexPage.drawText("Índice de archivos combinados:", {
      x: 50,
      y: yPosition,
      font,
      size: 14,
    });
    yPosition -= 20; // Espacio después del título

    selectedFiles.forEach((file, index) => {
      indexPage.drawText(`${index + 1}. ${file}`, {
        x: 50,
        y: yPosition,
        font,
        size: 12,
      });
      yPosition -= 20;
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
  };

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>Sube tus PDFs</h1>

      {/* Subir PDFs */}
      <input
        type="file"
        accept="application/pdf"
        onChange={handlePdfUpload}
        multiple
        style={{ display: 'block', margin: '0 auto', marginBottom: '20px' }}
      />

      <h2>Selecciona los PDFs para combinar (puedes cambiar el orden):</h2>
      {/* Arrastrar y soltar lista de archivos seleccionados */}
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

      {/* Selección de archivos PDF ya almacenados */}
      <select multiple onChange={handleSelectFile} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
        {pdfFiles.map((pdf, index) => (
          <option key={index} value={pdf.name}>
            {pdf.name}
          </option>
        ))}
      </select>

      {/* Input para elegir el nombre del archivo generado */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="outputFileName" style={{ display: 'block' }}>Nombre del archivo generado:</label>
        <input
          type="text"
          id="outputFileName"
          value={outputFileName}
          onChange={(e) => setOutputFileName(e.target.value)}
          placeholder="Introduce el nombre del archivo"
          style={{ width: '100%', padding: '10px' }}
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
